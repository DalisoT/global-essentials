'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MessageCircle, Check, Star, Shield, Truck, Share2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { formatCurrency, cn } from '@/lib/utils';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';

interface ProductDetailClientProps {
  product: CatalogProductWithImages;
  relatedProducts?: CatalogProductWithImages[];
  catalogProducts?: CatalogProductWithImages[];
}

export function ProductDetailClient({ product, relatedProducts = [], catalogProducts = [] }: ProductDetailClientProps) {
  const [showAdded, setShowAdded] = useState(false);

  const isOnSale = product.catalog_price && product.catalog_price < product.selling_price;

  const sendOrder = () => {
    const message = `Hi! I'm interested in ordering:\n\n*${product.name}*\nPrice: ${formatCurrency(product.selling_price)}\n\nPlease let me know how to proceed.`;
    return `https://wa.me/260980062299?text=${encodeURIComponent(message)}`;
  };

  const shareProduct = () => {
    const shareUrl = `https://global-essentials-zeta.vercel.app/catalog/${product.id}`;
    const message = `Check out ${product.name} for ${formatCurrency(product.selling_price)} at Global Essentials!`;
    return `https://wa.me/?text=${encodeURIComponent(message + '\n\n' + shareUrl)}`;
  };

  return (
    <div className="container mx-auto px-6 -mt-8 relative z-10 space-y-6">
      {/* Sale Badge */}
      {isOnSale && (
        <div className="flex items-center justify-center">
          <div className="px-4 py-2 rounded-full bg-tactical-red text-white text-sm font-black uppercase tracking-wider animate-pulse">
            🔥 SALE — Save {formatCurrency(product.selling_price - product.catalog_price!)}
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-3">
              {isOnSale ? (
                <>
                  <p className="text-4xl font-black text-tactical-neon">
                    {formatCurrency(product.catalog_price!)}
                  </p>
                  <p className="text-xl text-white/40 line-through">
                    {formatCurrency(product.selling_price)}
                  </p>
                </>
              ) : (
                <p className="text-4xl font-black text-tactical-neon">
                  {formatCurrency(product.selling_price)}
                </p>
              )}
            </div>
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
            {product.stock_level > 0 && product.stock_level <= 3 && (
              <motion.span
                className="text-xs font-bold text-tactical-red uppercase tracking-wide ml-2 animate-pulse"
              >
                🔥 Only {product.stock_level} left!
              </motion.span>
            )}
            {product.stock_level > 3 && product.stock_level <= 5 && (
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
                Order via WhatsApp
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

          {/* Share Button */}
          <button
            onClick={() => window.open(shareProduct(), '_blank')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 text-white/50 font-bold hover:bg-white/5 transition-all"
          >
            <Share2 className="w-5 h-5" />
            Share via WhatsApp
          </button>

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

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="max-w-xl mx-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-3">
            You May Also Like
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {relatedProducts.slice(0, 6).map((rp) => (
              <Link
                key={rp.id}
                href={`/catalog/${rp.id}`}
                className="flex-shrink-0 w-32 group"
              >
                <div className="w-32 h-32 rounded-xl bg-white/5 overflow-hidden mb-2">
                  {rp.images[0] ? (
                    <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Star className="w-8 h-8 text-white/10" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold truncate">{rp.name}</p>
                <p className="text-sm text-tactical-neon font-black">{formatCurrency(rp.selling_price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}