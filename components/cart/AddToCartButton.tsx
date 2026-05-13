'use client';

import { useState } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import { ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    selling_price: number;
    image_url?: string | null;
    image_urls?: string[] | null;
    stock_level: number;
  };
  quantity?: number;
  showQuantitySelector?: boolean;
}

export function AddToCartButton({ product, quantity = 1, showQuantitySelector = false }: AddToCartButtonProps) {
  const [selectedQty, setSelectedQty] = useState(quantity);
  const [added, setAdded] = useState(false);
  const { addItem, openCart } = useCartStore();

  const inStock = product.stock_level > 0;
  const maxStock = product.stock_level;

  const images = product.image_urls?.length
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : product.images?.length
        ? product.images
        : [];

  const handleAdd = () => {
    if (!inStock) return;

    addItem({
      productId: product.id,
      name: product.name,
      price: product.selling_price,
      quantity: selectedQty,
      image: images[0],
      maxStock: product.stock_level,
    });

    setAdded(true);
    toast.success(`${product.name} added to cart`);

    setTimeout(() => setAdded(false), 1500);
    openCart();
  };

  if (showQuantitySelector) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">Qty:</span>
          <select
            value={selectedQty}
            onChange={(e) => setSelectedQty(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
          >
            {Array.from({ length: Math.min(maxStock, 10) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={!inStock || added}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg hover:bg-white transition-all disabled:opacity-50"
        >
          {added ? <Check className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
          {added ? 'Added!' : 'Add to Cart'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={!inStock || added}
      className={cn(
        'w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-lg transition-all',
        added
          ? 'bg-tactical-neon text-black'
          : inStock
            ? 'bg-tactical-neon text-black hover:bg-white'
            : 'bg-white/10 text-white/40 cursor-not-allowed'
      )}
    >
      {added ? <Check className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
      {added ? 'Added to Cart!' : inStock ? 'Add to Cart' : 'Out of Stock'}
    </button>
  );
}