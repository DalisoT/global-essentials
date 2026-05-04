'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  selling_price: number;
  image_url: string | null;
  image_urls: string[] | null;
  stock_level: number;
  description?: string;
}

interface AnimatedProductCardProps {
  product: Product;
  index: number;
}

export function AnimatedProductCard({ product, index }: AnimatedProductCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Build images array from image_urls with fallback to image_url
  const images = product.image_urls && product.image_urls.length > 0
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];

  const hasMultiple = images.length > 1;

  const sendOrder = (productName: string, price: number) => {
    const message = `Hi! I'm interested in ordering:\n\n*${productName}*\nPrice: ${formatCurrency(price)}\n\nPlease let me know how to proceed.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const paginate = (newDirection: number) => {
    setCurrentIndex((prev) => {
      if (newDirection > 0) {
        return prev === images.length - 1 ? 0 : prev + 1;
      } else {
        return prev === 0 ? images.length - 1 : prev - 1;
      }
    });
  };

  // Stock status
  const getStockStatus = () => {
    if (product.stock_level === 0) return { label: 'Out of Stock', class: 'bg-tactical-red/80' };
    if (product.stock_level <= 5) return { label: 'Low Stock', class: 'bg-tactical-orange/80' };
    return { label: 'In Stock', class: 'bg-tactical-neon/80' };
  };

  const stockStatus = getStockStatus();

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
        {/* Product Image with Carousel */}
        <div className="aspect-square relative overflow-hidden bg-white/5">
          {images.length > 0 ? (
            <>
              <motion.img
                key={currentIndex}
                src={images[currentIndex]}
                alt={product.name}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />

              {/* Carousel Navigation */}
              {hasMultiple && (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); paginate(-1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); paginate(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(idx); }}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          idx === currentIndex ? 'bg-tactical-neon w-3' : 'bg-white/40 hover:bg-white/60'
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Star className="w-16 h-16 text-white/10 group-hover:text-white/20 transition-colors" />
            </div>
          )}

          {/* Stock Badge */}
          <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${stockStatus.class} text-black`}>
            {stockStatus.label}
          </div>

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
        <div className="p-4">
          <h3 className="font-bold text-sm mb-1 truncate">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-white/50 mb-2 line-clamp-2">{product.description}</p>
          )}
          <p className="text-xl font-black text-tactical-neon">
            {formatCurrency(product.selling_price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}