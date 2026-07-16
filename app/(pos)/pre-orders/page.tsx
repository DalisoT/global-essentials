import Link from 'next/link';
import { Plus, ClipboardList } from 'lucide-react';
import { getPreOrderStats, listPreOrders } from '@/lib/actions/pre-orders';
import { getProductMap } from './helpers';
import { PreOrdersList } from '@/components/pre-orders/PreOrdersList';
import type { PreOrderStatus } from '@/lib/supabase-types';

/**
 * Admin pre-orders list (Phase 11 / 11.6).
 *
 * Server component. Reads status filter + search from the
 * URL, fetches the matching rows + stats + product names,
 * hands it all to the client list component.
 *
 * The same component handles selection + bulk "mark arrived"
 * via the action wired up in 11.3.
 */

const STATUS_VALUES: (PreOrderStatus | 'all' | 'active')[] = [
  'all',
  'active',
  'pending',
  'deposit_paid',
  'arrived',
  'completed',
  'cancelled',
  'refunded',
];

function normaliseStatus(value: string | undefined): PreOrderStatus | 'all' | 'active' {
  if (value && (STATUS_VALUES as string[]).includes(value)) {
    return value as PreOrderStatus | 'all' | 'active';
  }
  return 'all';
}

export default async function PreOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const status = normaliseStatus(searchParams.status);
  const search = (searchParams.q ?? '').trim();

  const [listRes, statsRes] = await Promise.all([
    listPreOrders({
      status,
      limit: 200,
      ...(search ? { whatsapp: search } : {}),
    }),
    getPreOrderStats(),
  ]);

  // The list query searches by WhatsApp only; the client side
  // also filters by name / tracking code to avoid a separate
  // full-text search column at v1.
  const allOrders = listRes.data ?? [];
  const filtered = search
    ? allOrders.filter((o) => {
        const q = search.toLowerCase();
        return (
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_whatsapp.includes(search) ||
          (o.tracking_code ?? '').toLowerCase().includes(q)
        );
      })
    : allOrders;

  const productMap = await getProductMap(filtered.map((o) => o.product_id));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-tactical text-tactical">Pre-orders</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            Customers waiting on a future import
          </p>
        </div>
        <Link
          href="/pre-orders/new"
          className="btn-tactical inline-flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-4 h-4" />
          New
        </Link>
      </div>

      {/* Stats row */}
      {statsRes.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="Active"
            value={String(
              statsRes.data.pending +
                statsRes.data.deposit_paid +
                statsRes.data.arrived
            )}
            sub={`${statsRes.data.pending} pending`}
            tone="blue"
          />
          <StatCard
            label="Deposits held"
            value={formatK(statsRes.data.total_deposits_held)}
            sub={`${formatK(statsRes.data.total_expected_revenue)} expected`}
            tone="neon"
          />
          <StatCard
            label="Completed"
            value={String(statsRes.data.completed)}
            sub="delivered to customer"
            tone="blue"
          />
          <StatCard
            label="Cancelled / refunded"
            value={String(
              statsRes.data.cancelled + statsRes.data.refunded
            )}
            sub={`${statsRes.data.cancelled} forfeit · ${statsRes.data.refunded} refund`}
            tone="red"
          />
        </div>
      )}

      {listRes.error ? (
        <div className="card-tactical border-tactical-red/30 p-3 text-sm text-tactical-red">
          Failed to load pre-orders: {listRes.error}
        </div>
      ) : (
        <PreOrdersList
          initialOrders={filtered}
          productMap={productMap}
          currentStatus={status}
          currentSearch={search}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'blue' | 'neon' | 'red';
}) {
  const toneCls = {
    blue: 'text-tactical-blue',
    neon: 'text-tactical-neon',
    red: 'text-tactical-red',
  }[tone];
  return (
    <div className="card-tactical p-3 space-y-0.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
        {label}
      </p>
      <p className={`text-lg font-black ${toneCls}`}>{value}</p>
      <p className="text-[10px] text-white/40 leading-tight">{sub}</p>
    </div>
  );
}

function formatK(n: number): string {
  return `K${Math.round(n).toLocaleString('en-US')}`;
}
