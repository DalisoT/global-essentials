'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, syncPendingSales } from '@/lib/offline/sync';
import { createSale } from '@/lib/actions/sales';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    setSyncError(null);
    try {
      const result = await syncPendingSales(createSale);
      setLastSyncedAt(new Date());
      if (result.failed > 0) {
        setSyncError(`${result.failed} sale(s) failed to sync`);
      }
      await checkPending();
      return result;
    } catch {
      setSyncError('Sync failed');
      return { synced: 0, failed: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [checkPending]);

  return { pendingCount, isSyncing, lastSyncedAt, syncError, triggerSync, checkPending };
}