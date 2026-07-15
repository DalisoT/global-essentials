import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductById, getCatalogProducts, getRelatedProducts } from '@/lib/actions/catalog';
import { getProductReviews, getProductRatingStats } from '@/lib/actions/reviews';
import { ArrowLeft, MessageCircle, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductImageCarousel } from './ProductImageCarousel';
import { ProductDetailClient } from '../product-detail/ProductDetailClient';
import { TrackView } from '@/components/catalog/TrackView';
import { CartDrawer } from '@/components/cart/CartDrawer';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';

export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: { productId: string };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const [{ data: product }, { data: allProducts }, { data: reviews }, ratingStats, { data: relatedData }] = await Promise.all([
    getProductById(productId),
    getCatalogProducts(),
    getProductReviews(productId),
    getProductRatingStats(productId),
    getRelatedProducts(productId, 6),
  ]);

  if (!product) {
    notFound();
  }

  const typedProduct = product as CatalogProductWithImages;

  // 8.3 — co-purchase / category / fallback. The action returns
  // enriched rows with a `reason` tag we can show in the UI later.
  const relatedProducts = (relatedData ?? []).map((r) => r.product);

  return (
    <div className="min-h-screen bg-black pb-20">
      <TrackView productId={productId} />

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
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </motion.div>

      <ProductDetailClient product={typedProduct} relatedProducts={relatedProducts} catalogProducts={allProducts || []} reviews={reviews || []} ratingStats={ratingStats} />
      <CartDrawer />
    </div>
  );
}