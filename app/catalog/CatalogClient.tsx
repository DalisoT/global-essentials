'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Phone, Star, Search } from 'lucide-react';
import { AnimatedProductCard } from './AnimatedProductCard';
import { CartIcon } from '@/components/cart/CartIcon';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CategoryFilter } from '@/components/catalog/CategoryFilter';
import type { CatalogProductWithImages } from '@/lib/actions/catalog';
import type { Category } from '@/lib/supabase-types';

interface CatalogClientProps {
  products: CatalogProductWithImages[];
  categories: Category[];
}

export function CatalogClient({ products, categories }: CatalogClientProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || (p as any).category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-black">
      <CartDrawer />

      {/* Header with Cart */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/catalog" className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1" />
              <span className="font-black uppercase tracking-tight hidden sm:block">Global Essentials</span>
            </Link>
            <CartIcon />
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

      {/* Search and Filter */}
      {categories.length > 0 && (
        <section className="container mx-auto px-6 py-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
            />
          </div>
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(id) => setSelectedCategory(id)}
          />
        </section>
      )}

      {/* Products Grid */}
      <section className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black uppercase tracking-tight">
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name || 'Products'
              : 'Featured Products'}
          </h2>
          <span className="text-sm text-white/40">{filteredProducts.length} items</span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product: any, index: number) => (
            <AnimatedProductCard
              key={product.id}
              product={product}
              index={index}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
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