'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useOffline } from '@/hooks/useOffline';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { syncPendingSales } from '@/lib/offline/sync';
import { createSale } from '@/lib/actions/sales';

/**
 * Service worker registration + update + sync + offline UI glue.
 *
 * Responsibilities:
 *   1. Register /sw.js on first mount.
 *   2. Detect a new version waiting (registration.waiting) and offer a
 *      "refresh now" toast — the new SW won't activate until all tabs are
 *      closed, so we have to ask the user to reload.
 *   3. Listen for 'controllerchange' (the new SW took over) and reload the
 *      page once, so the user lands on the fresh code.
 *   4. Listen for SYNC_PENDING_SALES messages from the SW and run the
 *      client-side sync helper. Also triggered when the user comes back
 *      online.
 *   5. Show a toast when the user goes offline so they know sales are
 *      being saved locally.
 */
export function ServiceWorkerRegistration() {
  const { isOnline } = useOffline();
  const { pendingCount, isSyncing } = useSyncStatus();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ── 1. Register the SW + watch for updates ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onNewWaiting = (reg: ServiceWorkerRegistration) => {
      registrationRef.current = reg;
      setUpdateAvailable(true);
      toast(
        () => (
          <div className="flex flex-col gap-2">
            <div>
              <p className="font-bold text-sm">New version available</p>
              <p className="text-xs text-white/60">Refresh to get the latest features and fixes.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!registrationRef.current?.waiting) return;
                  registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
                  toast.dismiss('sw-update');
                }}
                className="px-3 py-1.5 rounded-lg bg-tactical-blue text-white text-xs font-bold"
              >
                Refresh now
              </button>
              <button
                onClick={() => {
                  setUpdateAvailable(false);
                  toast.dismiss('sw-update');
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs font-bold"
              >
                Later
              </button>
            </div>
          </div>
        ),
        {
          id: 'sw-update',
          duration: Infinity,
          position: 'top-center',
        }
      );
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registrationRef.current = registration;
        // If a SW was waiting from a previous page load (user closed the
        // update toast), still surface it.
        if (registration.waiting && navigator.serviceWorker.controller) {
          onNewWaiting(registration);
        }
        // Listen for newly installed workers that are waiting.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is installed but waiting for old tabs to close.
              onNewWaiting(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    // 3. When the new SW takes over (after SKIP_WAITING), reload once.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // ── 2. Sync messages from the SW ────────────────────────────────
  const handleSyncMessage = useCallback(async (event: MessageEvent) => {
    if (event.data?.type !== 'SYNC_PENDING_SALES') return;
    const result = await syncPendingSales(createSale);
    if (result.synced > 0) {
      toast.success(`Synced ${result.synced} pending sale(s)`);
    }
    if (result.failed > 0) {
      toast.error(`Failed to sync ${result.failed} sale(s)`);
    }
  }, []);

  useEffect(() => {
    navigator.serviceWorker?.addEventListener('message', handleSyncMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSyncMessage);
  }, [handleSyncMessage]);

  // ── 3. Offline indicator ────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      toast.error('You are offline. Sales will be saved locally.', {
        id: 'offline-indicator',
        duration: 4000,
      });
    }
  }, [isOnline]);

  // ── 4. Auto-sync when coming back online ────────────────────────
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      toast.success(`Syncing ${pendingCount} pending sale(s)...`);
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_PENDING_SALES' });
      }
    }
  }, [isOnline, pendingCount, isSyncing]);

  // ── 5. Persistent storage + background sync registration ───────
  // Run once after the first user interaction so we don't get blocked
  // by Safari's "user activation required" prompt suppression.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let done = false;
    const run = async () => {
      if (done) return;
      done = true;
      window.removeEventListener('pointerdown', run);
      window.removeEventListener('keydown', run);

      // 5a. Ask the browser to keep our IndexedDB even under storage pressure.
      // Without this, the browser can evict offline sales without warning.
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        try {
          const alreadyPersisted = await navigator.storage.persisted?.();
          if (!alreadyPersisted) {
            const granted = await navigator.storage.persist();
            console.log(`[PWA] Persistent storage: ${granted ? 'granted' : 'denied'}`);
          }
        } catch (err) {
          console.warn('[PWA] persist() failed:', err);
        }
      }

      // 5b. Register a background-sync tag so the SW can sync pending sales
      // even if the user has closed the app. The tag is processed by the
      // 'sync' event handler in /sw.js. Unsupported on iOS Safari + Firefox,
      // but harmless — we still sync on the 'online' event as a fallback.
      try {
        const reg = await navigator.serviceWorker?.ready;
        // @ts-expect-error — SyncManager is not in lib.dom yet
        if (reg?.sync && typeof reg.sync.register === 'function') {
          // @ts-expect-error
          await reg.sync.register('sync-sales');
          console.log('[PWA] Background sync registered');
        }
      } catch (err) {
        console.warn('[PWA] Background sync registration failed:', err);
      }
    };
    // Trigger on first interaction — browsers require user activation before
    // they let us call persist() / register sync.
    window.addEventListener('pointerdown', run, { once: true });
    window.addEventListener('keydown', run, { once: true });
    return () => {
      window.removeEventListener('pointerdown', run);
      window.removeEventListener('keydown', run);
    };
  }, []);

  return null;
}

// keep the export referenced so tree-shaking doesn't drop the helper
export const _updateAvailableForTest = () => {};
