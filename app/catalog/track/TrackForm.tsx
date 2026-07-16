'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
  CreditCard,
  Truck,
  XCircle,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatK } from '@/lib/pre-orders/pricing';
import { lookupPreOrderPublic } from '@/lib/actions/pre-orders';
import type {
  PreOrder,
  PreOrderEvent,
  PreOrderEventType,
  PreOrderStatus,
} from '@/lib/supabase-types';

const STATUS_BADGES: Record<PreOrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Awaiting deposit', cls: 'bg-tactical-orange/20 text-tactical-orange' },
  deposit_paid: { label: 'Deposit paid · waiting for shipment', cls: 'bg-tactical-blue/20 text-tactical-blue' },
  arrived: { label: 'Stock arrived! Pay balance to collect', cls: 'bg-tactical-neon/20 text-tactical-neon' },
  completed: { label: 'Completed', cls: 'bg-tactical-neon/20 text-tactical-neon' },
  cancelled: { label: 'Cancelled', cls: 'bg-tactical-red/20 text-tactical-red' },
  refunded: { label: 'Refunded', cls: 'bg-tactical-red/20 text-tactical-red' },
};

const STATUS_BLURB: Record<PreOrderStatus, string> = {
  pending: 'Your pre-order is registered. Pay the deposit to lock it in.',
  deposit_paid: 'Your deposit is received — we&apos;ve ordered the boots. We&apos;ll text you when the shipment lands.',
  arrived: 'The boots are in! Come in to pay the balance and collect.',
  completed: 'Done — you collected the boots. Thanks for your order!',
  cancelled: 'This pre-order was cancelled.',
  refunded: 'This pre-order was refunded.',
};

/**
 * Public tracker form (Phase 11 / 11.8).
 *
 * Submits to lookupPreOrderPublic which is rate-limited
 * (10/hour per IP). The result is rendered with a customer-
 * friendly event timeline; internal events (status_changed,
 * source_action metadata) are filtered out server-side.
 */
export function TrackForm() {
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get('code') ?? '').trim().toUpperCase();
  const [code, setCode] = useState(initialCode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (PreOrder & { events: PreOrderEvent[] }) | null
  >(null);

  function lookup(target: string) {
    const clean = target.trim().toUpperCase();
    if (!clean) {
      setError('Enter your tracking code');
      return;
    }
    if (!/^PR-\d{4}-\d{4}$/.test(clean)) {
      setError('That code doesn&apos;t look right. Format: PR-2026-0042');
      return;
    }
    setError(null);
    setResult(null);
    const rateKey =
      typeof window !== 'undefined'
        ? navigator.userAgent + ':track'
        : 'server';
    startTransition(async () => {
      const res = await lookupPreOrderPublic({
        tracking_code: clean,
        rate_limit_key: rateKey,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.data) setResult(res.data);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookup(code);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PR-2026-0042"
            maxLength={12}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-base font-bold tracking-widest focus:border-tactical-blue/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-tactical-blue text-white font-black uppercase tracking-wide hover:bg-tactical-neon hover:text-black transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Track
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-tactical-red/30 bg-tactical-red/5 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-tactical-red mt-0.5 shrink-0" />
          <p className="text-sm text-white/80">{error}</p>
        </div>
      )}

      {result && <ResultCard order={result} />}
    </div>
  );
}

function ResultCard({ order }: { order: PreOrder & { events: PreOrderEvent[] } }) {
  const badge = STATUS_BADGES[order.status];
  const icon = STATUS_ICON[order.status];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Tracking code
        </p>
        <span
          className={cn(
            'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0',
            badge.cls
          )}
        >
          {badge.label}
        </span>
      </div>
      <p className="text-2xl font-black text-tactical-neon tracking-widest">
        {order.tracking_code ?? '—'}
      </p>
      <p className="text-xs text-white/70">{STATUS_BLURB[order.status]}</p>

      {/* Pricing reminder */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat label="Total" value={formatK(order.unit_price)} />
        <Stat
          label="Deposit"
          value={formatK(order.deposit_amount)}
          paid={order.status !== 'pending'}
        />
        <Stat
          label="Balance"
          value={formatK(order.balance_due)}
          paid={order.status === 'completed'}
        />
      </div>

      {/* Expected delivery */}
      <div className="flex items-center gap-2 text-[10px] text-white/60">
        <Calendar className="w-3 h-3" />
        Expected by {prettyDate(order.expected_delivery_date)}
      </div>

      {/* Timeline */}
      <div className="pt-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2">
          Updates
        </p>
        {order.events.length === 0 ? (
          <p className="text-xs text-white/40">No updates yet.</p>
        ) : (
          <ol className="space-y-2">
            {order.events.map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-tactical-blue mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-white/80">
                    {labelForEvent(e.event_type)}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {prettyDateTime(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

const STATUS_ICON: Record<PreOrderStatus, typeof CheckCircle2> = {
  pending: CreditCard,
  deposit_paid: Package,
  arrived: Truck,
  completed: CheckCircle2,
  cancelled: XCircle,
  refunded: XCircle,
};

function Stat({
  label,
  value,
  paid = false,
}: {
  label: string;
  value: string;
  paid?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-2 text-center',
        paid ? 'bg-tactical-neon/5' : 'bg-white/5'
      )}
    >
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-black',
          paid ? 'text-tactical-neon' : 'text-white'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function labelForEvent(type: PreOrderEventType): string {
  switch (type) {
    case 'created':
      return 'Pre-order registered';
    case 'deposit_paid':
      return 'Deposit received';
    case 'arrived':
      return 'Stock arrived at the shop';
    case 'balance_paid':
      return 'Balance received';
    case 'completed':
      return 'Completed — you collected';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
    case 'notified':
    case 'message_queued':
    case 'message_sent':
      return 'Update sent to you on WhatsApp';
    case 'status_changed':
      return 'Status updated';
    default:
      return 'Update';
  }
}

function prettyDate(dateStr: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

function prettyDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lusaka',
  });
}
