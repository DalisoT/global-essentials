'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Check, Star, Shield, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { formatCurrency } from '@/lib/utils';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';

interface ProductDetailClientProps {
  product: CatalogProductWithImages;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [showAdded, setShowAdded] = useState(false);

  const sendOrder = () => {
    const message = `Hi! I'm interested in ordering:\n\n*${product.name}*\nPrice: ${formatCurrency(product.selling_price)}\n\nPlease let me know how to proceed.`;
    return `https://wa.me/260980062299?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="container mx-auto px-6 -mt-8 relative z-10">
      <div className="max-w-xl mx-auto">
        <motion.div
          className="bg-tactical-slate rounded-3xl p-6 space-y-6 border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h1 className="text-3xl font-black tracking-tight mb-2">{product.name}</h1>
            <p className="text-4xl font-black text-tactical-neon">
              {formatCurrency(product.selling_price)}
            </p>
          </motion.div>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <motion.div
              className={`w-3 h-3 rounded-full ${
                product.stock_level > 0 ? 'bg-tactical-neon' : 'bg-tactical-red'
              }`}
              animate={product.stock_level > 0 ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
              {product.stock_level > 0 ? 'In Stock' : 'Out of Stock'}
            </span>
            {product.stock_level > 0 && product.stock_level <= 5 && (
              <motion.span
                className="text-xs font-bold text-tactical-orange uppercase tracking-wide ml-2"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Only {product.stock_level} left
              </motion.span>
            )}
          </motion.div>

          <motion.div
            className="grid grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <motion.div className="text-center" whileHover={{ scale: 1.05 }}>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6 text-tactical-blue" />
              </div>
              <p className="text-xs text-white/60">Quality Assured</p>
            </motion.div>
            <motion.div className="text-center" whileHover={{ scale: 1.05 }}>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                <Truck className="w-6 h-6 text-tactical-blue" />
              </div>
              <p className="text-xs text-white/60">Fast Delivery</p>
            </motion.div>
            <motion.div className="text-center" whileHover={{ scale: 1.05 }}>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6 text-tactical-blue" />
              </div>
              <p className="text-xs text-white/60">Best Price</p>
            </motion.div>
          </motion.div>

          {product.stock_level > 0 ? (
            <>
              <AddToCartButton product={product} />
              <motion.a
                href={sendOrder()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/20 text-white/70 font-bold hover:bg-white/10 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <MessageCircle className="w-5 h-5" />
                Or order via WhatsApp
              </motion.a>
            </>
          ) : (
            <motion.a
              href={sendOrder()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-tactical-neon text-black font-black text-lg hover:bg-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <MessageCircle className="w-6 h-6" />
              Notify Me When Available
            </motion.a>
          )}

          <motion.p
            className="text-center text-xs text-white/30 uppercase tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            Free delivery on orders over K500
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}