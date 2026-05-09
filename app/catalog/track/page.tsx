'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package } from 'lucide-react';
import Link from 'next/link';

export default function TrackSearchPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');

  const handleSearch = () => {
    if (!orderNumber.trim()) return;
    // Try to find order by order number - redirect to the track page with orderId
    router.push(`/catalog/track/${encodeURIComponent(orderNumber.trim())}`);
  };

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-2xl font-black mb-6">Track Your Order</h1>

        <div className="card-tactical mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter your Order ID (e.g., GE-2024-00001)"
              className="flex-1 h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
            />
            <button
              onClick={handleSearch}
              disabled={!orderNumber.trim()}
              className="px-6 h-12 rounded-xl bg-tactical-neon text-black font-bold hover:bg-white transition-all disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-white/40 mt-3">
            Your order ID was sent to your WhatsApp after order confirmation.
          </p>
        </div>

        <div className="text-center py-16">
          <Package className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 uppercase tracking-widest">
            Enter your order ID to track your order
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/catalog"
            className="text-tactical-neon hover:underline text-sm"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    </div>
  );
}