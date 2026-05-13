'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MessageCircle, Phone, Star, Search, Heart, ArrowRight, X } from 'lucide-react';
import { AnimatedProductCard } from './AnimatedProductCard';
import { CartIcon } from '@/components/cart/CartIcon';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CategoryFilter } from '@/components/catalog/CategoryFilter';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { useRecentlyViewedStore } from '@/lib/stores/recently-viewed-store';
import { formatCurrency } from '@/lib/utils';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';
import type { Category } from '@/lib/supabase-types';

type SortOption = 'name_asc' | 'price_low' | 'price_high' | 'stock';

interface CatalogClientProps {
  products: CatalogProductWithImages[];
  categories: Category[];
}

export function CatalogClient({ products, categories }: CatalogClientProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { getCount } = useWishlistStore();
  const { productIds: recentIds } = useRecentlyViewedStore();
  const wishlistCount = getCount();

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || (p as any).category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    switch (sortBy) {
      case 'price_low':
        return sorted.sort((a, b) => a.selling_price - b.selling_price);
      case 'price_high':
        return sorted.sort((a, b) => b.selling_price - a.selling_price);
      case 'stock':
        return sorted.sort((a, b) => b.stock_level - a.stock_level);
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [filteredProducts, sortBy]);

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().startsWith(search.toLowerCase()))
      .slice(0, 6);
  }, [search, products]);

  const recentProducts = useMemo(() => {
    return recentIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .slice(0, 6) as CatalogProductWithImages[];
  }, [recentIds, products]);

  return (
    <div className="min-h-screen bg-black">
      <CartDrawer />

      {/* Header with Cart and Wishlist */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/catalog" className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1" />
              <span className="font-black uppercase tracking-tight hidden sm:block">Global Essentials</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/catalog/wishlist" className="relative p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Heart className="w-6 h-6 text-white/70" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-tactical-red rounded-full text-white text-xs font-bold flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <CartIcon />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-tactical-blue/20 via-transparent to-tactical-neon/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-tactical-blue/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-tactical-neon/20 rounded-full blur-3xl" />
        <div className="relative container mx-auto px-6 py-12">
          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            Browse our collection of premium essentials. Quality products at unbeatable prices.
          </p>
          <Link
            href="https://wa.me/260980062299"
            target="_blank"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-tactical-neon text-black font-bold hover:bg-tactical-neon/90 transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            Chat with Us
          </Link>
        </div>
      </section>

      {/* Recently Viewed */}
      {recentProducts.length > 0 && (
        <section className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">Recently Viewed</h3>
            <button onClick={() => useRecentlyViewedStore.getState().clear()} className="text-xs text-white/30 hover:text-white/50">
              Clear
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {recentProducts.map((p) => (
              <Link key={p.id} href={`/catalog/${p.id}`} className="flex-shrink-0 w-28">
                <div className="w-28 h-28 rounded-xl bg-white/5 overflow-hidden mb-1">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Star className="w-8 h-8 text-white/10" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold truncate">{p.name}</p>
                <p className="text-xs text-tactical-neon">{formatCurrency(p.selling_price)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Search and Filter */}
      <section className="container mx-auto px-6 py-4 space-y-4">
        {/* Search with autocomplete */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search products..."
            className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-tactical-slate rounded-xl border border-white/10 overflow-hidden shadow-xl">
              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  href={`/catalog/${p.id}`}
                  onClick={() => { setSearch(''); setShowSuggestions(false); }}
                  className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Star className="w-5 h-5 text-white/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <p className="text-sm text-tactical-neon">{formatCurrency(p.selling_price)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sort + Category row */}
        <div className="flex items-center justify-between gap-3">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(id) => setSelectedCategory(id === selectedCategory ? null : id)}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm flex-shrink-0"
          >
            <option value="name_asc">A-Z</option>
            <option value="price_low">Price: Low</option>
            <option value="price_high">Price: High</option>
            <option value="stock">Most Stock</option>
          </select>
        </div>
      </section>

      {/* Products Grid */}
      <section className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight">
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name || 'Products'
              : 'Featured Products'}
          </h2>
          <span className="text-sm text-white/40">{sortedProducts.length} items</span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sortedProducts.map((product: any, index: number) => (
            <AnimatedProductCard
              key={product.id}
              product={product}
              index={index}
            />
          ))}
        </div>

        {sortedProducts.length === 0 && (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 uppercase tracking-widest">No products found</p>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-tactical-blue to-tactical-neon opacity-20" />
          <div className="relative p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
              Can&apos;t Find What You&apos;re Looking For?
            </h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Contact us directly and we&apos;ll help you find the perfect product.
            </p>
            <Link
              href="https://wa.me/260980062299"
              target="_blank"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-tactical-neon text-black font-bold text-lg hover:bg-white transition-all"
            >
              <Phone className="w-5 h-5" />
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 mt-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-black uppercase tracking-tight">Global Essentials</span>
          </div>
          <p className="text-white/40 text-sm">Premium Quality. Fair Prices.</p>
        </div>
      </footer>
    </div>
  );
}