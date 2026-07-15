'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { MessageCircle, Check, Star, Shield, Truck, Share2, ChevronRight, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { formatCurrency, cn } from '@/lib/utils';
import { createReview, getProductReviews, getProductRatingStats, type ProductReview } from '@/lib/actions/reviews';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';

interface ProductDetailClientProps {
  product: CatalogProductWithImages;
  relatedProducts?: CatalogProductWithImages[];
  catalogProducts?: CatalogProductWithImages[];
  reviews?: ProductReview[];
  ratingStats?: { average: number; count: number };
  /** 8.6 — pre-rendered review summary card. Renders above the
   *  raw review list. Server-rendered by the page wrapper. */
  reviewSummary?: React.ReactNode;
}

export function ProductDetailClient({ product, relatedProducts = [], catalogProducts = [], reviews: initialReviews = [], ratingStats: initialStats, reviewSummary }: ProductDetailClientProps) {
  const [showAdded, setShowAdded] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [ratingStats, setRatingStats] = useState(initialStats || { average: 0, count: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      const [reviewsRes, statsRes] = await Promise.all([
        getProductReviews(product.id),
        getProductRatingStats(product.id),
      ]);
      if (reviewsRes.data) setReviews(reviewsRes.data);
      if (statsRes) setRatingStats(statsRes);
    }
    loadReviews();
  }, [product.id]);

  const handleReviewSubmit = async () => {
    if (!reviewName.trim() || reviewRating === 0) return;
    setReviewSubmitting(true);
    const { error } = await createReview({
      product_id: product.id,
      customer_name: reviewName.trim(),
      rating: reviewRating,
      comment: reviewComment.trim() || undefined,
    });
    setReviewSubmitting(false);
    if (!error) {
      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewName('');
      setReviewComment('');
      setReviewRating(0);
    }
  };

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

          {/* Rating Stars */}
          {ratingStats.count > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn('w-4 h-4', star <= Math.round(ratingStats.average) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20')}
                  />
                ))}
              </div>
              <span className="text-sm text-white/60">{ratingStats.average.toFixed(1)} ({ratingStats.count} review{ratingStats.count !== 1 ? 's' : ''})</span>
            </div>
          )}

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

      {/* Reviews Section */}
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
            Reviews ({ratingStats.count})
          </h3>
          {!showReviewForm && !reviewSuccess && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="px-4 py-2 rounded-xl bg-tactical-neon text-black text-sm font-bold hover:bg-white transition-all"
            >
              Write a Review
            </button>
          )}
        </div>

        {reviewSuccess && (
          <div className="bg-tactical-neon/20 border border-tactical-neon/30 rounded-2xl p-4 text-center">
            <p className="text-tactical-neon font-bold">Thanks for your review!</p>
            <p className="text-sm text-white/60 mt-1">It will appear after approval.</p>
          </div>
        )}

        {showReviewForm && (
          <motion.div
            className="bg-tactical-slate rounded-3xl p-6 border border-white/10 space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <label className="text-sm font-bold uppercase text-white/60 mb-2 block">Your Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        'w-8 h-8 transition-colors',
                        star <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20 hover:text-yellow-400/50'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold uppercase text-white/60 mb-2 block">Your Name</label>
              <input
                type="text"
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="John M."
                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
              />
            </div>
            <div>
              <label className="text-sm font-bold uppercase text-white/60 mb-2 block">Comment (optional)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewName(''); setReviewComment(''); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={!reviewName.trim() || reviewRating === 0 || reviewSubmitting}
                className="flex-1 py-3 rounded-xl bg-tactical-neon text-black font-bold hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reviewSubmitting ? (
                  <span className="animate-pulse">Submitting...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Review
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* 8.6 — AI summary (server-rendered, above the raw list) */}
        {reviewSummary}

        {/* Review List */}
        {reviews.length > 0 ? (
          <div className="space-y-3 mt-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-tactical-slate rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-tactical-neon/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-tactical-neon">{review.customer_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-bold">{review.customer_name}</span>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn('w-3 h-3', star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20')}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-white/70 text-sm">{review.comment}</p>
                )}
                <p className="text-xs text-white/30 mt-2">
                  {new Date(review.created_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        ) : !showReviewForm && !reviewSuccess && (
          <div className="text-center py-8 text-white/40">
            <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reviews yet. Be the first to review this product!</p>
          </div>
        )}
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