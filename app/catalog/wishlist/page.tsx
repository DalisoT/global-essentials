'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { AnimatedProductCard } from '../AnimatedProductCard';
import { Heart, ArrowLeft, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';
import { useCartStore } from '@/lib/stores/cart-store';

interface WishlistPageProps {
  products: CatalogProductWithImages[];
}

export default function WishlistPage({ products }: WishlistPageProps) {
  const { items, clear } = useWishlistStore();

  const wishlistProducts = useMemo(() => {
    return items
      .map((item) => products.find((p) => p.id === item.productId))
      .filter(Boolean) as CatalogProductWithImages[];
  }, [items, products]);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/catalog" className="flex items-center gap-2 text-white/60 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold uppercase tracking-wide text-sm">Back to Catalog</span>
            </Link>
            {wishlistProducts.length > 0 && (
              <button
                onClick={clear}
                className="flex items-center gap-2 text-tactical-red text-sm font-bold hover:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Wishlist
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-tactical-red/20 flex items-center justify-center">
            <Heart className="w-6 h-6 text-tactical-red" />
          </div>
          <div>
            <h1 className="text-2xl font-black">My Wishlist</h1>
            <p className="text-sm text-white/60 uppercase tracking-wider">
              {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {/* Wishlist Grid */}
        {wishlistProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-white/10" />
            </div>
            <h2 className="text-xl font-black mb-2">Your wishlist is empty</h2>
            <p className="text-white/40 mb-8">Save items you love by tapping the heart icon on any product</p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-tactical-neon text-black font-bold hover:bg-white transition-all"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {wishlistProducts.map((product, index) => (
              <AnimatedProductCard
                key={product.id}
                product={product}
                index={index}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}