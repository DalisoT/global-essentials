import Link from 'next/link';
import { Package } from 'lucide-react';
import { requireAuth } from '@/lib/supabase-server';
import { getOrders } from '@/lib/actions/catalog-orders';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { OrdersFilter } from '@/components/orders/OrdersFilter';
import { formatCurrency } from '@/lib/utils';

/**
 * Admin orders list (Phase 8 / 8.5).
 *
 * Server component. Lists every order with a status filter chip
 * bar above. Each row is a link to the detail page. The auth
 * gate is implicit (this page lives under the (pos) layout,
 * which requires an authenticated user).
 */
export const dynamic = 'force-dynamic';

interface OrdersPageProps {
  searchParams?: { filter?: string };
}

const VALID_FILTERS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type FilterValue = typeof VALID_FILTERS[number];

function isValidFilter(v: string | undefined): v is FilterValue {
  return !!v && (VALID_FILTERS as readonly string[]).includes(v);
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return (
      <div className="card-tactical p-6 text-center">
        <p className="text-tactical-red font-bold">Unauthorized</p>
      </div>
    );
  }

  const filter: FilterValue = isValidFilter(searchParams?.filter)
    ? (searchParams!.filter as FilterValue)
    : 'all';

  const { data: orders, error } = await getOrders(filter === 'all' ? undefined : filter);

  // Counts for the filter chips.
  const all = await getOrders();
  const counts: Record<FilterValue, number> = {
    all: all.data?.length ?? 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const o of all.data ?? []) {
    const s = o.status as FilterValue;
    if (s in counts) counts[s] = (counts[s] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tighter">Orders</h1>
        <p className="text-xs text-white/50 uppercase tracking-wider">
          {counts.all} total · {counts.pending + counts.confirmed + counts.processing} in flight
        </p>
      </div>

      {/* Filter chips */}
      <OrdersFilter active={filter} counts={counts} />

      {/* Error state */}
      {error && (
        <div className="card-tactical border-tactical-red/30 bg-tactical-red/10 p-4">
          <p className="text-sm text-tactical-red font-bold">Couldn&apos;t load orders</p>
          <p className="text-xs text-white/60 mt-1">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && (!orders || orders.length === 0) && (
        <div className="card-tactical text-center py-12">
          <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40 uppercase tracking-widest">
            {filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
          </p>
        </div>
      )}

      {/* Order list */}
      {orders && orders.length > 0 && (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="card-tactical flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-tactical-neon">{o.order_number}</p>
                  <OrderStatusBadge status={o.status} size="sm" />
                </div>
                <p className="text-sm text-white/80 mt-0.5 truncate">{o.customer_name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {new Date(o.created_at).toLocaleDateString('en-ZM', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                  {o.items && o.items.length > 0 && (
                    <> · {o.items.length} item{o.items.length === 1 ? '' : 's'}</>
                  )}
                </p>
              </div>
              <p className="font-black text-base shrink-0">
                {formatCurrency(Number(o.total))}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
