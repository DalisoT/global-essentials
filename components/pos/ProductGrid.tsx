'use client';

import { useState, useEffect } from 'react';
import { getProducts } from '@/lib/actions/sales';
import { formatCurrency } from '@/lib/utils';
import { Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/supabase-types';

interface ProductGridProps {
  onAddProduct: (product: Product) => void;
  addedProductIds: Set<string>;
}

export function ProductGrid({ onAddProduct, addedProductIds }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts().then(({ data }) => {
      setProducts((data as Product[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full h-10 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((product) => {
          const inCart = addedProductIds.has(product.id);
          const outOfStock = product.stock_level <= 0;

          return (
            <button
              key={product.id}
              onClick={() => !outOfStock && onAddProduct(product)}
              disabled={outOfStock}
              className={cn(
                'relative p-3 rounded-2xl text-left transition-all',
                inCart
                  ? 'bg-tactical-neon/20 border-2 border-tactical-neon'
                  : 'bg-white/5 border border-white/10 hover:border-white/30',
                outOfStock && 'opacity-40 cursor-not-allowed'
              )}
            >
              <div className="w-full aspect-square rounded-xl bg-white/5 flex items-center justify-center mb-2">
                <Package className="w-8 h-8 text-white/30" />
              </div>
              <p className="font-bold text-sm leading-tight line-clamp-2 mb-1">
                {product.name}
              </p>
              <p className="text-tactical-neon font-black text-sm">
                {formatCurrency(product.selling_price)}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {outOfStock ? 'Out of stock' : `Stock: ${product.stock_level}`}
              </p>
              {inCart && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-tactical-neon flex items-center justify-center">
                  <span className="text-black text-[10px] font-bold">+</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/30 text-sm uppercase tracking-wide">
            No products found
          </p>
        </div>
      )}
    </div>
  );
}