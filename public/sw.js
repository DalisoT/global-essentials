// Global Essentials Service Worker v2
//
// Cache strategy:
//   - CACHE_STATIC  → app shell, manifest, icons (cache-first, bump version to invalidate)
//   - CACHE_PAGES   → HTML pages (network-first, fall back to cache, then /offline)
//   - CACHE_IMAGES  → product images, logos (stale-while-revalidate)
//   - CACHE_API     → read-only Supabase REST GETs (network-first, 10s timeout, fall back to cache)
//
// Always bump VERSION on any change to this file so the activate handler
// nukes old caches. The HTML page is NEVER served from cache directly — only
// as a fallback when the network fails — so users always see fresh code.

const VERSION = 'v2.0.0';
const CACHE_STATIC = `ge-static-${VERSION}`;
const CACHE_PAGES = `ge-pages-${VERSION}`;
const CACHE_IMAGES = `ge-images-${VERSION}`;
const CACHE_API = `ge-api-${VERSION}`;

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

const API_TIMEOUT_MS = 10_000;
const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const API_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Install — pre-cache the app shell
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      // addAll fails the whole install if any single request fails. Use
      // individual add() calls so a missing icon doesn't break install.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn(`[SW] Failed to pre-cache ${url}:`, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────
// Activate — drop old caches, claim clients
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES, CACHE_API]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => !keep.has(n)).map((n) => {
          console.log(`[SW] Deleting old cache: ${n}`);
          return caches.delete(n);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────
// Fetch — route by content type
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only
  if (url.origin !== self.location.origin) {
    // Cross-origin (e.g. Supabase storage, R2). Handle Supabase storage as images.
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.r2.cloudflarestorage.com')) {
      event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    }
    return;
  }

  // Skip auth and server-action endpoints entirely — they must hit the network.
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/cron') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/signout')
  ) {
    return;
  }

  // Navigations (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Supabase REST API (read-only GETs)
  if (url.pathname.startsWith('/rest/v1/') || url.pathname.includes('/supabase/')) {
    event.respondWith(networkFirstWithTimeout(request, CACHE_API, API_TIMEOUT_MS));
    return;
  }

  // Images
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  // Static assets (JS, CSS, fonts, hashed Next chunks) — cache-first is safe
  // because the filenames include content hashes.
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith(networkFirst(request));
});

// ─────────────────────────────────────────────────────────────
// Cache strategies
// ─────────────────────────────────────────────────────────────

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network down. Try the page in cache.
    const cached = await caches.match(request);
    if (cached) return cached;
    // Otherwise serve the offline page.
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cachePromise = caches.open(cacheName).then((c) => c.match(request));
  const networkPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

  const response = await Promise.race([networkPromise, timeoutPromise]);
  if (response) return response;
  const cached = await cachePromise;
  if (cached) return cached;
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  // Return cached immediately if present, otherwise wait for network.
  return cached || networkPromise || new Response('Image unavailable', { status: 503 });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response('Not available', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ─────────────────────────────────────────────────────────────
// Background sync — pending sales
// ─────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'SYNC_PENDING_SALES' }));
}

// ─────────────────────────────────────────────────────────────
// Push notifications
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Global Essentials', body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: !!data.tag,
    data: {
      url: data.url || '/dashboard',
      saleId: data.saleId,
      installmentId: data.installmentId,
    },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Global Essentials', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If a tab is already open, focus it and navigate.
      for (const client of clients) {
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      // Otherwise open a new window.
      return self.clients.openWindow(url);
    })
  );
});

// ─────────────────────────────────────────────────────────────
// Client messages — manual sync trigger + skip waiting
// ─────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'SYNC_PENDING_SALES') {
    event.waitUntil(notifyClientsToSync());
  } else if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => event.source && event.source.postMessage({ type: 'CACHES_CLEARED' }))
    );
  }
});
