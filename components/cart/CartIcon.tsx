'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CartIcon() {
  const { toggleCart, getItemCount } = useCartStore();
  const count = getItemCount();

  return (
    <button
      onClick={toggleCart}
      className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
    >
      <ShoppingCart className="w-6 h-6" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-tactical-neon text-black text-xs font-bold rounded-full flex items-center justify-center"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}