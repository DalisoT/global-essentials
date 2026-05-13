import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/actions/catalog-orders';
import { formatCurrency } from '@/lib/utils';
import { Check, Package, MapPin, Truck } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import Link from 'next/link';

interface TrackOrderPageProps {
  params: { orderId: string };
}

const SHIPPING_TRANSIT: Record<string, number> = {
  'Air Express': 7,
  'Air General 7D': 7,
  'Air Sensitive 14D': 14,
  'Sea Express VIP': 50,
  'Standard Delivery': 5,
  'Express Delivery': 1,
};

function getEstimatedDelivery(createdAt: string, shippingMethod: string | null): string {
  const days = shippingMethod ? (SHIPPING_TRANSIT[shippingMethod] ?? 7) : 7;
  const date = new Date(createdAt);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-ZM', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default async function TrackOrderPage({ params }: TrackOrderPageProps) {
  const { orderId } = await params;
  const { data: order, error } = await getOrderById(orderId);

  if (error || !order) {
    notFound();
  }

  const statusSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
  const currentIdx = statusSteps.indexOf(order.status as typeof statusSteps[number]);

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2">Order Confirmed</h1>
          <p className="text-white/60">
            Thank you, {order.customer_name}. Your order is being processed.
          </p>
        </div>

        <div className="card-tactical text-center mb-6">
          <p className="text-sm text-white/60 uppercase tracking-wider mb-1">Order Number</p>
          <p className="text-3xl font-black text-tactical-neon">{order.order_number}</p>
          <div className="mt-3">
            <OrderStatusBadge status={order.status} />
          </div>
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/60">
              <Truck className="w-4 h-4" />
              <span>Estimated delivery: <span className="font-bold text-white">{getEstimatedDelivery(order.created_at, order.shipping_method)}</span></span>
            </div>
          )}
        </div>

        <div className="card-tactical mb-6">
          <h2 className="text-lg font-bold mb-4">Order Progress</h2>
          <div className="space-y-4">
            {statusSteps.map((status, i) => {
              const isComplete = i <= currentIdx;
              const isCurrent = status === order.status;

              return (
                <div key={status} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-tactical-neon text-black' : 'bg-white/10'
                    }`}
                  >
                    {isComplete && <Check className="w-4 h-4" />}
                    {!isComplete && <span className="text-xs">{i + 1}</span>}
                  </div>
                  <div>
                    <p className={`font-bold capitalize ${isCurrent ? 'text-tactical-neon' : ''}`}>
                      {status}
                    </p>
                    {isCurrent && <p className="text-sm text-white/60">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-tactical mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-tactical-blue" />
            Order Summary
          </h2>
          <div className="space-y-2">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.product_name} x{item.quantity}</span>
                <span className="font-black text-tactical-neon">
                  {formatCurrency(item.total_price)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4 flex justify-between font-black">
            <span>Total</span>
            <span className="text-tactical-neon">{formatCurrency(Number(order.total))}</span>
          </div>
        </div>

        <div className="card-tactical mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-tactical-blue" />
            Delivery Address
          </h2>
          <p className="font-bold">{order.shipping_address_line}</p>
          <p className="text-white/60">{order.shipping_city}, {order.shipping_province}</p>
          {order.shipping_postal_code && (
            <p className="text-white/60">{order.shipping_postal_code}</p>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href="/catalog/track"
            className="block w-full py-4 rounded-2xl border border-white/20 text-white/70 font-bold text-center hover:bg-white/5 transition-all"
          >
            Track Another Order
          </Link>
          <Link
            href="/catalog"
            className="block w-full py-4 rounded-2xl bg-tactical-neon text-black font-black text-lg text-center hover:bg-white transition-all"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    </div>
  );
}