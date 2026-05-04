'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, syncPendingSales } from '@/lib/offline/sync';
import { createSale } from '@/lib/actions/sales';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [checkPending]);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncPendingSales(createSale);
      await checkPending();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [checkPending]);

  return { pendingCount, isSyncing, triggerSync, checkPending };
}