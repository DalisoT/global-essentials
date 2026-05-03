'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUndo } from '@/hooks/useUndo';
import { softDelete } from '@/lib/actions/soft-delete';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemId: string;
  itemTable: 'products' | 'clients' | 'sales' | 'expenses';
  onDeleted?: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  itemName,
  itemId,
  itemTable,
  onDeleted,
}: DeleteConfirmModalProps) {
  const { showUndoToast } = useUndo();

  const handleDelete = async () => {
    onClose();

    await showUndoToast(
      `${itemName} deleted`,
      { id: itemId, table: itemTable, itemName },
      () => softDelete(itemTable, itemId),
      { onConfirm: onDeleted }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tactical-slate rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-tactical-red/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-tactical-red" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Delete {itemName}?</h3>
          <p className="text-white/60 text-sm">
            This action can be undone within 10 seconds.
          </p>
        </div>

        <div className="flex gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 btn-tactical-secondary h-12"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 btn-tactical-danger h-12"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}