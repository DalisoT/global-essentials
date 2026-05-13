'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Phone, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getOrders } from '@/lib/actions/catalog-orders';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { OrderWithItems } from '@/lib/supabase-types';

export default function TrackSearchPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [lookupBy, setLookupBy] = useState<'order' | 'phone'>('order');
  const [phoneOrders, setPhoneOrders] = useState<OrderWithItems[]>([]);
  const [loadingPhone, setLoadingPhone] = useState(false);

  const handleSearch = () => {
    if (!orderNumber.trim()) return;
    router.push(`/catalog/track/${encodeURIComponent(orderNumber.trim())}`);
  };

  const handlePhoneSearch = async () => {
    if (!phone.trim()) return;
    setLoadingPhone(true);
    const { data } = await getOrders();
    const matched = (data || []).filter((o) =>
      o.customer_phone.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))
    );
    setPhoneOrders(matched);
    setLoadingPhone(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-2xl font-black mb-6">Track Your Order</h1>

        {/* Lookup Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setLookupBy('order'); setPhoneOrders([]); }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${
              lookupBy === 'order'
                ? 'bg-tactical-neon text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            By Order ID
          </button>
          <button
            onClick={() => { setLookupBy('phone'); setPhoneOrders([]); }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${
              lookupBy === 'phone'
                ? 'bg-tactical-neon text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            By Phone
          </button>
        </div>

        {lookupBy === 'order' ? (
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
        ) : (
          <div className="card-tactical mb-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
                placeholder="Enter your WhatsApp number (e.g., 0977123456)"
                className="flex-1 h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon"
              />
              <button
                onClick={handlePhoneSearch}
                disabled={!phone.trim() || loadingPhone}
                className="px-6 h-12 rounded-xl bg-tactical-neon text-black font-bold hover:bg-white transition-all disabled:opacity-50"
              >
                <Phone className="w-5 h-5" />
              </button>
            </div>

            {/* Phone search results */}
            {phoneOrders.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-white/40 uppercase tracking-wider">
                  {phoneOrders.length} order{phoneOrders.length > 1 ? 's' : ''} found
                </p>
                {phoneOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/catalog/track/${order.id}`}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <p className="font-black text-tactical-neon">{order.order_number}</p>
                      <p className="text-sm text-white/60">{order.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} size="sm" />
                      <p className="font-black">{formatCurrency(Number(order.total))}</p>
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {phoneOrders.length === 0 && phone.length >= 7 && !loadingPhone && (
              <p className="text-sm text-white/40">No orders found for this number</p>
            )}
          </div>
        )}

        <div className="text-center py-16">
          <Package className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 uppercase tracking-widest">
            {lookupBy === 'order' ? 'Enter your order ID to track your order' : 'Enter your phone number to find orders'}
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