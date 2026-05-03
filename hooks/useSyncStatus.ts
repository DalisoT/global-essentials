'use client';

import { useState, useEffect } from 'react';
import { getPendingCount } from '@/lib/offline/sync';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    // Sync will be triggered by the syncPendingSales function
    // called from a useEffect in the layout or page
    setTimeout(() => setIsSyncing(false), 2000);
  };

  return { pendingCount, isSyncing, triggerSync };
}