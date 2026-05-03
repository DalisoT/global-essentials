'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Star } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  selling_price: number;
  image_url: string | null;
}

interface AnimatedProductCardProps {
  product: Product;
  index: number;
}

export function AnimatedProductCard({ product, index }: AnimatedProductCardProps) {
  const sendOrder = (productName: string, price: number) => {
    const message = `Hi! I'm interested in ordering:\n\n*${productName}*\nPrice: ${formatCurrency(price)}\n\nPlease let me know how to proceed.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.02 }}
    >
      <Link
        href={`/catalog/${product.id}`}
        className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl overflow-hidden border border-white/10 hover:border-tactical-blue/50 transition-all duration-300 hover:shadow-lg hover:shadow-tactical-blue/20"
      >
        {/* Product Image */}
        <div className="aspect-square relative overflow-hidden bg-white/5">
          {product.image_url ? (
            <motion.img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Star className="w-16 h-16 text-white/10 group-hover:text-white/20 transition-colors" />
            </div>
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Quick Order Button */}
          <motion.div
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
          >
            <a
              href={sendOrder(product.name, product.selling_price)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-tactical-neon/90 text-black text-xs font-bold hover:bg-tactical-neon transition-colors"
            >
              <MessageCircle className="w-3 h-3" /> Order
            </a>
          </motion.div>
        </div>

        {/* Product Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-sm mb-1 truncate">{product.name}</h3>
          <p className="text-xl font-black text-tactical-neon">
            {formatCurrency(product.selling_price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
