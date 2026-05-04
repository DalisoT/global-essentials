'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Star, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  const goToDetail = useCallback(() => {
    // Don't navigate if lightbox is open
    if (lightboxOpen) return false;
    return true;
  }, [lightboxOpen]);

  // Stock status
  const getStockStatus = () => {
    if (product.stock_level === 0) return { label: 'Out of Stock', class: 'bg-tactical-red/80' };
    if (product.stock_level <= 5) return { label: 'Low Stock', class: 'bg-tactical-orange/80' };
    return { label: 'In Stock', class: 'bg-tactical-neon/80' };
  };

  const stockStatus = getStockStatus();

  return (
    <>
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
        <div className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-3xl overflow-hidden border border-white/10 hover:border-tactical-blue/50 transition-all duration-300 hover:shadow-lg hover:shadow-tactical-blue/20">
          {/* Product Image with Carousel */}
          <div className="aspect-square relative overflow-hidden bg-white/5">
            {images.length > 0 ? (
              <>
                <motion.img
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
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
              <div
                className="w-full h-full flex items-center justify-center cursor-pointer"
                onClick={(e) => { e.preventDefault(); setLightboxOpen(true); }}
              >
                <Star className="w-16 h-16 text-white/10 group-hover:text-white/20 transition-colors" />
              </div>
            )}

            {/* Stock Badge */}
            <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${stockStatus.class} text-black`}>
              {stockStatus.label}
            </div>

            {/* Quick Order Button - Hidden, will be on detail page */}
          </div>

          {/* Product Info */}
          <Link href={`/catalog/${product.id}`} className="block p-4">
            <h3 className="font-bold text-sm mb-1 truncate">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-white/50 mb-2 line-clamp-2">{product.description}</p>
            )}
            <p className="text-xl font-black text-tactical-neon">
              {formatCurrency(product.selling_price)}
            </p>
          </Link>
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all z-10"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.div
              key={currentIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[currentIndex]}
                alt={product.name}
                className="max-w-full max-h-full object-contain"
              />
            </motion.div>

            {/* Navigation */}
            {hasMultiple && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); paginate(-1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); paginate(1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Dots indicator */}
            {hasMultiple && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentIndex ? 'bg-tactical-neon w-4' : 'bg-white/40'
                    }`}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Product info at bottom */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
              <p className="text-white font-bold">{product.name}</p>
              <p className="text-tactical-neon font-black">{formatCurrency(product.selling_price)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}