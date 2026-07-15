import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, Truck, Package } from 'lucide-react';
import { requireAuth } from '@/lib/supabase-server';
import { getOrderById } from '@/lib/actions/catalog-orders';
import { formatCurrency } from '@/lib/utils';
import { OrderStatusControls } from '@/components/orders/OrderStatusControls';

/**
 * Admin order detail (Phase 8 / 8.5).
 *
 * Server component. Shows everything the shop owner needs to
 * fulfil an order: customer contact, shipping address, line items,
 * totals, and the OrderStatusControls client component for
 * advancing the order through the workflow.
 */
export const dynamic = 'force-dynamic';

interface AdminOrderDetailProps {
  params: { orderId: string };
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailProps) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return (
      <div className="card-tactical p-6 text-center">
        <p className="text-tactical-red font-bold">Unauthorized</p>
      </div>
    );
  }

  const { data: order, error } = await getOrderById(params.orderId);
  if (error || !order) notFound();

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All orders
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tighter">
          {order.order_number}
        </h1>
        <p className="text-xs text-white/50 uppercase tracking-wider">
          Placed {new Date(order.created_at).toLocaleString('en-ZM', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      {/* Status controls (advance + tracking + cancel) */}
      <OrderStatusControls
        orderId={order.id}
        currentStatus={order.status}
        currentTracking={order.shipping_tracking}
      />

      {/* Customer + delivery */}
      <div className="card-tactical space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
            Customer
          </p>
          <p className="font-bold">{order.customer_name}</p>
          <a
            href={`tel:${order.customer_phone}`}
            className="inline-flex items-center gap-1.5 text-sm text-tactical-blue hover:text-tactical-neon transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {order.customer_phone}
          </a>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
            Delivery address
          </p>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-white/40 mt-0.5" />
            <div>
              <p className="text-sm">{order.shipping_address_line}</p>
              <p className="text-sm text-white/60">
                {order.shipping_city}, {order.shipping_province}
                {order.shipping_postal_code && `, ${order.shipping_postal_code}`}
              </p>
            </div>
          </div>
        </div>
        {order.shipping_method && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
              Shipping method
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-white/40" />
              {order.shipping_method}
            </div>
          </div>
        )}
        {order.notes && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
              Customer notes
            </p>
            <p className="text-sm text-white/80 italic">&ldquo;{order.notes}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="card-tactical">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-tactical-blue" />
          <p className="text-sm font-bold uppercase tracking-wider">Line items</p>
        </div>
        <div className="space-y-2">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{item.product_name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {formatCurrency(Number(item.unit_price))} × {item.quantity}
                  {item.product_sku && <> · SKU {item.product_sku}</>}
                </p>
              </div>
              <p className="font-black text-tactical-neon">
                {formatCurrency(Number(item.total_price))}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 mt-3 pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Subtotal</span>
            <span>{formatCurrency(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Delivery</span>
            <span>{formatCurrency(Number(order.shipping_cost))}</span>
          </div>
          <div className="flex justify-between font-black text-base pt-1 border-t border-white/5">
            <span>Total</span>
            <span className="text-tactical-neon">{formatCurrency(Number(order.total))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
