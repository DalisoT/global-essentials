import { create } from 'zustand';

interface InventoryStore {
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  selectedProductId: null,
  setSelectedProductId: (id) => set({ selectedProductId: id }),
}));