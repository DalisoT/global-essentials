import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentlyViewedState {
  productIds: string[];
  addProduct: (productId: string) => void;
  clear: () => void;
  getRecent: () => string[];
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      productIds: [],

      addProduct: (productId) => {
        const { productIds } = get();
        const filtered = productIds.filter((id) => id !== productId);
        const updated = [productId, ...filtered].slice(0, 10);
        set({ productIds: updated });
      },

      clear: () => set({ productIds: [] }),

      getRecent: () => get().productIds,
    }),
    { name: 'ge-recently-viewed', partialize: (state) => ({ productIds: state.productIds }) }
  )
);