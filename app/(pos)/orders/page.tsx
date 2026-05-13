'use client';

import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus } from '@/lib/actions/catalog-orders';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { Package, Truck, Check, X, Phone, MapPin, Search } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { toast } from 'sonner';
import type { OrderWithItems } from '@/lib/supabase-types';

const WHATSAPP_TEMPLATES: Record<string, string> = {
  confirmed: "Hi {name}, your order {number} has been confirmed! We'll start preparing it shortly.",
  shipped: "Hi {name}, your order {number} is now out for delivery!",
  delivered: "Hi {name}, your order {number} has been delivered. Thank you for shopping with us!",
  cancelled: "Hi {name}, your order {number} has been cancelled. Please contact us if you have questions.",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = async () => {
    setIsLoading(true);
    const { data } = await getOrders(statusFilter || undefined);
    setOrders(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderWithItems['status']) => {
    // Get the order before updating (for WhatsApp notification)
    const order = orders.find((o) => o.id === orderId);

    const { error } = await updateOrderStatus(orderId, newStatus);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success(`Order ${newStatus}`);
    loadOrders();

    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }

    // Send WhatsApp notification for status transitions with templates
    const template = WHATSAPP_TEMPLATES[newStatus];
    if (template && order?.customer_phone) {
      const message = template
        .replace('{name}', order.customer_name)
        .replace('{number}', order.order_number);
      const phone = order.customer_phone.replace(/\D/g, '');
      window.open(getWhatsAppLink(phone, message), '_blank');
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Online Orders</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="h-10 pl-9 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-neon text-sm w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 uppercase tracking-widest">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={`card-tactical text-left hover:bg-white/5 transition-all ${
                selectedOrder?.id === order.id ? 'border-tactical-blue' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-black text-tactical-neon">{order.order_number}</p>
                  <p className="text-sm text-white/60">{order.customer_name}</p>
                </div>
                <OrderStatusBadge status={order.status} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">
                  {order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} items
                </span>
                <span className="font-black">{formatCurrency(Number(order.total))}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-white/40">
                  {new Date(order.created_at).toLocaleDateString('en-ZM', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-white/40">{order.shipping_city}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-tactical-slate rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">{selectedOrder.order_number}</h2>
                  <div className="mt-2">
                    <OrderStatusBadge status={selectedOrder.status} />
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="card-tactical bg-white/5">
                <h3 className="font-bold mb-2">Customer</h3>
                <p className="font-semibold">{selectedOrder.customer_name}</p>
                <a
                  href={`https://wa.me/${selectedOrder.customer_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  className="text-tactical-blue flex items-center gap-1 text-sm"
                >
                  <Phone className="w-4 h-4" />
                  {selectedOrder.customer_phone}
                </a>
                {selectedOrder.customer_email && (
                  <p className="text-sm text-white/60 mt-1">{selectedOrder.customer_email}</p>
                )}
              </div>

              <div>
                <h3 className="font-bold mb-2">Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span className="font-black">{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-2 pt-2 flex justify-between font-black">
                  <span>Total</span>
                  <span className="text-tactical-neon">{formatCurrency(Number(selectedOrder.total))}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery
                </h3>
                <p className="text-sm">{selectedOrder.shipping_address_line}</p>
                <p className="text-sm text-white/60">{selectedOrder.shipping_city}, {selectedOrder.shipping_province}</p>
                {selectedOrder.shipping_postal_code && (
                  <p className="text-sm text-white/60">{selectedOrder.shipping_postal_code}</p>
                )}
                {selectedOrder.shipping_method && (
                  <p className="text-sm text-white/60 mt-1">{selectedOrder.shipping_method}</p>
                )}
              </div>

              {selectedOrder.notes && (
                <div>
                  <h3 className="font-bold mb-2">Notes</h3>
                  <p className="text-sm text-white/60">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                {selectedOrder.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, 'confirmed')}
                      className="px-6 py-3 rounded-xl bg-tactical-neon text-black font-bold flex items-center gap-2 hover:bg-white transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Confirm
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelled')}
                      className="px-6 py-3 rounded-xl border border-tactical-red/30 text-tactical-red font-bold flex items-center gap-2 hover:bg-tactical-red/10 transition-all"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'processing')}
                    className="px-6 py-3 rounded-xl bg-tactical-neon text-black font-bold flex items-center gap-2 hover:bg-white transition-all"
                  >
                    <Package className="w-4 h-4" />
                    Start Processing
                  </button>
                )}
                {selectedOrder.status === 'processing' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'shipped')}
                    className="px-6 py-3 rounded-xl bg-tactical-neon text-black font-bold flex items-center gap-2 hover:bg-white transition-all"
                  >
                    <Truck className="w-4 h-4" />
                    Mark as Shipped
                  </button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'delivered')}
                    className="px-6 py-3 rounded-xl bg-tactical-neon text-black font-bold flex items-center gap-2 hover:bg-white transition-all"
                  >
                    <Check className="w-4 h-4" />
                    Mark as Delivered
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}