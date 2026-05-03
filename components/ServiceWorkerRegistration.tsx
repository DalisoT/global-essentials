'use client';

import { useEffect } from 'react';
import { useOffline } from '@/hooks/useOffline';
import { useSyncStatus } from '@/hooks/useSyncStatus';
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