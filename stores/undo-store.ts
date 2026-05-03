import { create } from 'zustand';

interface PendingDeletion {
  id: string;
  table: string;
  itemName: string;
  timestamp: number;
}

interface UndoStore {
  pendingDeletions: PendingDeletion[];
  addPendingDeletion: (deletion: PendingDeletion) => void;
  removePendingDeletion: (id: string) => void;
  clearExpired: () => void;
}

export const useUndoStore = create<UndoStore>((set) => ({
  pendingDeletions: [],
  addPendingDeletion: (deletion) =>
    set((state) => ({
      pendingDeletions: [...state.pendingDeletions, deletion],
    })),
  removePendingDeletion: (id) =>
    set((state) => ({
      pendingDeletions: state.pendingDeletions.filter((d) => d.id !== id),
    })),
  clearExpired: () =>
    set((state) => ({
      pendingDeletions: state.pendingDeletions.filter(
        (d) => Date.now() - d.timestamp < 10000
      ),
    })),
}));