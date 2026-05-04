import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/actions/catalog';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, MessageCircle, Check, Star, Shield, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductImageCarousel } from './ProductImageCarousel';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: { productId: string };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { data: product } = await getProductById(params.productId);

  if (!product) {
    notFound();
  }

  const typedProduct = product as CatalogProductWithImages;

  const sendOrder = () => {
    const message = `Hi! I'm interested in ordering:\n\n*${typedProduct.name}*\nPrice: ${formatCurrency(typedProduct.selling_price)}\n\nPlease let me know how to proceed.`;
    return `https://wa.me/260980062299?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Back Button */}
      <motion.div
        className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container mx-auto px-6 py-4">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold uppercase tracking-wide text-sm">Back to Catalog</span>
          </Link>
        </div>
      </motion.div>

      {/* Product Image with Ken Burns Effect */}
      <motion.div
        className="relative aspect-square max-w-xl mx-auto overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {typedProduct.images?.length ? (
          <ProductImageCarousel images={typedProduct.images} productName={typedProduct.name} />
        ) : (
          <motion.div
            className="w-full h-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Star className="w-32 h-32 text-white/10" />
          </motion.div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </motion.div>

      {/* Product Details */}
      <div className="container mx-auto px-6 -mt-8 relative z-10">
        <div className="max-w-xl mx-auto">
          <motion.div
            className="bg-tactical-slate rounded-3xl p-6 space-y-6 border border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Header */}
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

            {/* Stock Status */}
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
                animate={
                  product.stock_level > 0
                    ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }
                    : {}
                }
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

            {/* Features */}
            <motion.div
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <motion.div
                className="text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-6 h-6 text-tactical-blue" />
                </div>
                <p className="text-xs text-white/60">Quality Assured</p>
              </motion.div>
              <motion.div
                className="text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                  <Truck className="w-6 h-6 text-tactical-blue" />
                </div>
                <p className="text-xs text-white/60">Fast Delivery</p>
              </motion.div>
              <motion.div
                className="text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-6 h-6 text-tactical-blue" />
                </div>
                <p className="text-xs text-white/60">Best Price</p>
              </motion.div>
            </motion.div>

            {/* Order Button */}
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
              Order via WhatsApp
            </motion.a>

            <motion.p
              className="text-center text-xs text-white/30 uppercase tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              Click to start a conversation with our team
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
