'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';

/**
 * Offline fallback page. Served by the service worker when the user navigates
 * while offline and the requested page isn't in the page cache. Lives outside
 * the (pos) route group on purpose so it doesn't require authentication — the
 * user might open the app fresh while offline.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    // Use location.reload so the SW gets a chance to serve a fresh page
    // from the network if the user has come back online.
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div
      className="min-h-screen bg-black text-white flex items-center justify-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md w-full text-center">
        <div className="inline-flex w-20 h-20 rounded-full bg-tactical-orange/15 items-center justify-center mb-6">
          <CloudOff className="w-10 h-10 text-tactical-orange" />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">
          You&apos;re Offline
        </h1>
        <p className="text-white/60 text-sm mb-8 leading-relaxed">
          No internet connection. Don&apos;t worry — any sales you record will
          be saved locally and synced automatically when you&apos;re back online.
        </p>

        {isOnline ? (
          <div className="mb-6 p-3 rounded-xl bg-tactical-neon/10 border border-tactical-neon/30 flex items-center justify-center gap-2">
            <Wifi className="w-4 h-4 text-tactical-neon" />
            <span className="text-sm text-tactical-neon font-bold">
              You&apos;re back online!
            </span>
          </div>
        ) : null}

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="w-full max-w-xs mx-auto h-14 rounded-2xl bg-tactical-blue text-white font-black text-lg shadow-tactical hover:shadow-tactical-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={retrying ? 'w-5 h-5 animate-spin' : 'w-5 h-5'} />
          {retrying ? 'Retrying…' : 'Try again'}
        </button>

        <div className="mt-10 text-xs text-white/30 space-y-1">
          <p>Global Essentials · Offline Mode</p>
          <p>Your data is safe.</p>
        </div>
      </div>
    </div>
  );
}
