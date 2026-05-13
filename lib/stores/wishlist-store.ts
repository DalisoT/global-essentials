import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistItem {
  productId: string;
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  toggleItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  getCount: () => number;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) => {
        const { items } = get();
        if (items.some((i) => i.productId === productId)) return;
        set({ items: [...items, { productId, addedAt: new Date().toISOString() }] });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      toggleItem: (productId) => {
        const { items } = get();
        if (items.some((i) => i.productId === productId)) {
          get().removeItem(productId);
        } else {
          get().addItem(productId);
        }
      },

      isInWishlist: (productId) => {
        return get().items.some((i) => i.productId === productId);
      },

      getCount: () => get().items.length,

      clear: () => set({ items: [] }),
    }),
    { name: 'ge-wishlist', partialize: (state) => ({ items: state.items }) }
  )
);