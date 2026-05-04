'use client';

import { useEffect } from 'react';
import { useOffline } from '@/hooks/useOffline';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { syncPendingSales } from '@/lib/offline/sync';
import { createSale } from '@/lib/actions/sales';
import { toast } from 'sonner';

export function ServiceWorkerRegistration() {
  const { isOnline } = useOffline();
  const { pendingCount, isSyncing } = useSyncStatus();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    }
  }, []);

  // Listen for sync messages from service worker
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_PENDING_SALES') {
        const result = await syncPendingSales(createSale);
        if (result.synced > 0) {
          toast.success(`Synced ${result.synced} pending sale(s)`);
        }
        if (result.failed > 0) {
          toast.error(`Failed to sync ${result.failed} sale(s)`);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  // Show offline indicator
  useEffect(() => {
    if (!isOnline) {
      toast.error('You are offline. Sales will be saved locally.');
    }
  }, [isOnline]);

  // Sync pending sales when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      toast.success(`Syncing ${pendingCount} pending sale(s)...`);
      // Trigger sync via service worker message
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_PENDING_SALES' });
      }
    }
  }, [isOnline, pendingCount, isSyncing]);

  return null;
}