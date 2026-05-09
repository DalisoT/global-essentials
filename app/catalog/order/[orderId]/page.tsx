import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/actions/catalog-orders';
import { formatCurrency } from '@/lib/utils';
import { Check, Package, Truck, MapPin, Phone } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import Link from 'next/link';

interface OrderConfirmationProps {
  params: { orderId: string };
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationProps) {
  const { data: order, error } = await getOrderById(params.orderId);

  if (error || !order) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-tactical-neon/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-tactical-neon" />
          </div>
          <h1 className="text-3xl font-black mb-2">Order Confirmed!</h1>
          <p className="text-white/60">
            Thank you, {order.customer_name}. Your order has been received.
          </p>
        </div>

        <div className="card-tactical text-center mb-6">
          <p className="text-sm text-white/60 uppercase tracking-wider mb-1">Order Number</p>
          <p className="text-3xl font-black text-tactical-neon">{order.order_number}</p>
        </div>

        <div className="card-tactical mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/60 uppercase tracking-wider">Status</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-white/60">
            We&apos;ve sent a confirmation to your WhatsApp. We&apos;ll notify you when your order ships.
          </p>
        </div>

        <div className="card-tactical mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-tactical-blue" />
            Order Items
          </h2>
          <div className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <div>
                  <p className="font-bold">{item.product_name}</p>
                  <p className="text-sm text-white/60">Qty: {item.quantity}</p>
                </div>
                <p className="font-black text-tactical-neon">
                  {formatCurrency(item.total_price)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span>{formatCurrency(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Delivery</span>
              <span>{formatCurrency(Number(order.shipping_cost))}</span>
            </div>
            <div className="flex justify-between text-xl font-black">
              <span>Total</span>
              <span className="text-tactical-neon">{formatCurrency(Number(order.total))}</span>
            </div>
          </div>
        </div>

        <div className="card-tactical mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-tactical-blue" />
            Delivery
          </h2>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-white/40 mt-0.5" />
              <div>
                <p className="font-bold">{order.shipping_address_line}</p>
                <p className="text-white/60">{order.shipping_city}, {order.shipping_province}</p>
                {order.shipping_postal_code && (
                  <p className="text-white/60">{order.shipping_postal_code}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-white/40" />
              <p className="text-white/60">{order.customer_phone}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/catalog/track"
            className="block w-full py-4 rounded-2xl border border-white/20 text-white/70 font-bold text-center hover:bg-white/5 transition-all"
          >
            Track Your Order
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