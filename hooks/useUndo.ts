'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useUndoStore } from '@/stores/undo-store';
import { restore } from '@/lib/actions/soft-delete';

interface UseUndoOptions {
  onConfirm?: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
}

export function useUndo(options: UseUndoOptions = {}) {
  const { addPendingDeletion, removePendingDeletion } = useUndoStore();

  const showUndoToast = useCallback(
    async (
      message: string,
      deletion: { id: string; table: string; itemName: string },
      confirmAction: () => Promise<{ error?: string }>,
      undoOptions: UseUndoOptions = {}
    ) => {
      // Add to pending deletions
      addPendingDeletion({
        id: deletion.id,
        table: deletion.table,
        itemName: deletion.itemName,
        timestamp: Date.now(),
      });

      // Perform the delete action
      const { error } = await confirmAction();
      if (error) {
        removePendingDeletion(deletion.id);
        toast.error('Failed to delete');
        return;
      }

      // Call onConfirm if provided
      await undoOptions.onConfirm?.();

      // Show toast with undo
      toast.success(message, {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            const { error: restoreError } = await restore(
              deletion.table as 'products' | 'clients' | 'sales' | 'expenses',
              deletion.id
            );
            if (restoreError) {
              toast.error('Failed to undo');
            } else {
              toast.success(`${deletion.itemName} restored`);
              removePendingDeletion(deletion.id);
              await undoOptions.onUndo?.();
            }
          },
        },
      });

      // Remove after timeout
      setTimeout(() => {
        removePendingDeletion(deletion.id);
      }, 10000);
    },
    [addPendingDeletion, removePendingDeletion, options]
  );

  return { showUndoToast };
}