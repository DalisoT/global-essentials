'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  Check,
  ChevronRight,
  Ship,
  Plane,
  Package,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { cn, getWhatsAppLink } from '@/lib/utils';
import { formatK } from '@/lib/pre-orders/pricing';
import { markArrivedBulk } from '@/lib/actions/pre-orders-lifecycle';
import type {
  PreOrder,
  PreOrderStatus,
  Product,
} from '@/lib/supabase-types';

type StatusFilter = PreOrderStatus | 'all' | 'active';

const STATUS_PILLS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'deposit_paid', label: 'Deposit paid' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGES: Record<PreOrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-tactical-orange/20 text-tactical-orange' },
  deposit_paid: { label: 'Deposit paid', cls: 'bg-tactical-blue/20 text-tactical-blue' },
  arrived: { label: 'Arrived', cls: 'bg-tactical-purple/20 text-tactical-purple' },
  completed: { label: 'Done', cls: 'bg-tactical-neon/20 text-tactical-neon' },
  cancelled: { label: 'Cancelled', cls: 'bg-tactical-red/20 text-tactical-red' },
  refunded: { label: 'Refunded', cls: 'bg-tactical-red/20 text-tactical-red' },
};

export function PreOrdersList({
  initialOrders,
  productMap,
  currentStatus,
  currentSearch,
}: {
  initialOrders: PreOrder[];
  productMap: Record<string, Pick<Product, 'id' | 'name' | 'image_url'>>;
  currentStatus: StatusFilter;
  currentSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectable = useMemo(
    () => initialOrders.filter((o) => o.status === 'deposit_paid'),
    [initialOrders]
  );
  const selectableSet = useMemo(
    () => new Set(selectable.map((o) => o.id)),
    [selectable]
  );

  function setStatus(status: StatusFilter) {
    const params = new URLSearchParams(searchParams);
    if (status === 'all') params.delete('status');
    else params.set('status', status);
    router.push(`/pre-orders?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    router.push(`/pre-orders?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllArrived() {
    setSelectedIds(new Set(selectable.map((o) => o.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function bulkMarkArrived() {
    const ids = Array.from(selectedIds).filter((id) => selectableSet.has(id));
    if (ids.length === 0) {
      toast.error('Select at least one pre-order with deposit paid');
      return;
    }
    startTransition(async () => {
      const res = await markArrivedBulk(ids, 'Bulk marked from /pre-orders');
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const { updated, failed } = res.data ?? { updated: 0, failed: [] };
      if (failed.length > 0) {
        toast.warning(
          `Marked ${updated} arrived, ${failed.length} failed: ${failed.map((f) => f.error).join('; ')}`
        );
      } else {
        toast.success(`Marked ${updated} pre-order${updated === 1 ? '' : 's'} as arrived`);
      }
      clearSelection();
      router.refresh();
    });
  }

  if (initialOrders.length === 0) {
    return (
      <div className="card-tactical border-tactical-blue/30 p-6 text-center space-y-2">
        <Package className="w-8 h-8 text-tactical-blue mx-auto" />
        <p className="text-sm font-bold">No pre-orders match this filter</p>
        <p className="text-xs text-white/50">
          {currentStatus === 'all' && !currentSearch
            ? 'Register one from the POS or the catalog to get started.'
            : 'Try a different status or clear the search.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setStatus(p.value)}
            className={cn(
              'shrink-0 h-7 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors',
              currentStatus === p.value
                ? 'bg-tactical-blue text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, WhatsApp, or tracking code"
          className="input-tactical w-full text-sm pl-9"
        />
      </form>

      {/* Bulk action bar — shows when at least one deposit_paid row exists */}
      {selectable.length > 0 && (
        <div className="card-tactical border-tactical-purple/30 bg-tactical-purple/5 p-2.5 flex items-center gap-2 flex-wrap">
          <ListChecks className="w-4 h-4 text-tactical-purple shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${selectable.length} selected`
              : `${selectable.length} ready to mark arrived`}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            {selectedIds.size > 0 ? (
              <>
                <button
                  type="button"
                  onClick={selectAllArrived}
                  className="h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/60 hover:bg-white/10"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/60 hover:bg-white/10"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={bulkMarkArrived}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-tactical-purple/30 border border-tactical-purple/50 text-[10px] font-black uppercase tracking-widest text-tactical-purple hover:bg-tactical-purple/40 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Mark {selectedIds.size} arrived
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={selectAllArrived}
                className="h-7 px-2.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-tactical-purple/20 border border-tactical-purple/30 text-tactical-purple hover:bg-tactical-purple/30"
              >
                Select all
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        {initialOrders.map((o) => (
          <PreOrderRow
            key={o.id}
            order={o}
            product={productMap[o.product_id]}
            selectable={selectableSet.has(o.id)}
            selected={selectedIds.has(o.id)}
            onToggle={() => toggleSelect(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PreOrderRow({
  order,
  product,
  selectable,
  selected,
  onToggle,
}: {
  order: PreOrder;
  product: Pick<Product, 'id' | 'name' | 'image_url'> | undefined;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const badge = STATUS_BADGES[order.status];
  const ShippingIcon = order.shipping_mode === 'air' ? Plane : Ship;
  const overdue = order.expected_delivery_date < todayISO() &&
    ['pending', 'deposit_paid', 'arrived'].includes(order.status);

  return (
    <div
      className={cn(
        'card-tactical p-3 flex items-center gap-2.5',
        selected && 'border-tactical-purple/50 bg-tactical-purple/5'
      )}
    >
      {selectable && (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
            selected
              ? 'bg-tactical-purple border-tactical-purple'
              : 'border-white/20 hover:border-white/40'
          )}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </button>
      )}

      {product?.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-white/30" />
        </div>
      )}

      <Link
        href={`/pre-orders/${order.id}`}
        className="flex-1 min-w-0 hover:opacity-80"
      >
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm truncate">{order.customer_name}</p>
          <span
            className={cn(
              'text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0',
              badge.cls
            )}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-[10px] text-white/40 truncate">
          {order.tracking_code} · {product?.name ?? 'Unknown product'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/50">
          <span>{order.customer_whatsapp}</span>
          <span className="text-white/20">·</span>
          <span className="inline-flex items-center gap-0.5">
            <ShippingIcon className="w-2.5 h-2.5" />
            {order.shipping_mode}
          </span>
          <span className="text-white/20">·</span>
          <span className={overdue ? 'text-tactical-red' : ''}>
            expected {order.expected_delivery_date}
          </span>
        </div>
      </Link>

      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-xs font-bold">{formatK(order.unit_price)}</p>
        <p className="text-[10px] text-tactical-neon">
          dep {formatK(order.deposit_amount)}
        </p>
        <a
          href={getWhatsAppLink(order.customer_whatsapp, '')}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[10px] text-tactical-blue hover:text-tactical-neon"
          onClick={(e) => e.stopPropagation()}
        >
          WhatsApp
        </a>
      </div>

      <Link
        href={`/pre-orders/${order.id}`}
        className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
        aria-label="Open"
      >
        <ChevronRight className="w-4 h-4 text-white/40" />
      </Link>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
