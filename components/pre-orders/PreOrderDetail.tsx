'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Package,
  Plane,
  Ship,
  Phone,
  User,
  Calendar,
  CreditCard,
  XCircle,
  RefreshCcw,
  ChevronRight,
  Wallet,
  Loader2,
  StickyNote,
} from 'lucide-react';
import { cn, getWhatsAppLink, formatCurrency } from '@/lib/utils';
import { formatK } from '@/lib/pre-orders/pricing';
import {
  recordDepositPayment,
} from '@/lib/actions/pre-orders';
import {
  markArrived,
  convertToSale,
  cancelPreOrder,
} from '@/lib/actions/pre-orders-lifecycle';
import type {
  PreOrder,
  PreOrderEvent,
  PreOrderStatus,
  Product,
  ProductVariant,
} from '@/lib/supabase-types';

/**
 * Pre-order detail (Phase 11 / 11.5).
 *
 * The action buttons adapt to the current status. Each one
 * opens a small modal for the extra info we need (payment
 * method, cancel reason, etc).
 */

const STATUS_BADGES: Record<PreOrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending deposit', cls: 'bg-tactical-orange/20 text-tactical-orange' },
  deposit_paid: { label: 'Deposit paid', cls: 'bg-tactical-blue/20 text-tactical-blue' },
  arrived: { label: 'Stock arrived', cls: 'bg-tactical-purple/20 text-tactical-purple' },
  completed: { label: 'Completed', cls: 'bg-tactical-neon/20 text-tactical-neon' },
  cancelled: { label: 'Cancelled', cls: 'bg-tactical-red/20 text-tactical-red' },
  refunded: { label: 'Refunded', cls: 'bg-tactical-red/20 text-tactical-red' },
};

export function PreOrderDetail({
  order,
  events,
  product,
  variant,
}: {
  order: PreOrder;
  events: PreOrderEvent[];
  product: Product | null;
  variant: ProductVariant | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<ActionKind | null>(null);

  const isActive = ['pending', 'deposit_paid', 'arrived'].includes(
    order.status
  );

  function runMutation<R>(
    promise: Promise<{ error?: string; data?: R }>,
    successMsg: string
  ) {
    startTransition(async () => {
      const res = await promise;
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(successMsg);
      setAction(null);
      router.refresh();
    });
  }

  function recordDeposit(amount: number, method: string, note: string) {
    runMutation(
      recordDepositPayment({
        pre_order_id: order.id,
        amount,
        method: method as 'cash' | 'mobile_money' | 'bank' | 'other',
        note: note || undefined,
      }),
      'Deposit recorded'
    );
  }

  function doMarkArrived() {
    runMutation(
      markArrived({ pre_order_id: order.id }),
      'Marked as arrived. Customer can be notified now.'
    );
  }

  function doConvert(method: string) {
    runMutation(
      convertToSale({
        pre_order_id: order.id,
        balance_amount: order.balance_due,
        payment_method: method as 'cash' | 'mobile_money' | 'bank' | 'other',
      }),
      'Pre-order completed · sale created'
    );
  }

  function doCancel(reason: string, refund: boolean, refundAmount: number, refundMethod: string) {
    runMutation(
      cancelPreOrder({
        pre_order_id: order.id,
        reason,
        refund_deposit: refund,
        refund_amount: refund ? refundAmount : undefined,
        refund_method: refund ? (refundMethod as 'cash' | 'mobile_money' | 'bank' | 'other') : undefined,
      }),
      refund ? 'Cancelled + deposit refunded' : 'Cancelled (deposit forfeited per terms)'
    );
  }

  const badge = STATUS_BADGES[order.status];
  const ShippingIcon = order.shipping_mode === 'air' ? Plane : Ship;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="card-tactical p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
              Tracking code
            </p>
            <p className="text-2xl font-black text-tactical-neon tracking-wider">
              {order.tracking_code ?? '—'}
            </p>
          </div>
          <span
            className={cn(
              'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded',
              badge.cls
            )}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-white/60">
          Registered {prettyDateTime(order.created_at)} · via {order.source}
        </p>
      </div>

      {/* Customer card */}
      <div className="card-tactical p-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Customer
        </p>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-tactical-blue" />
          <p className="font-bold text-sm">{order.customer_name}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-tactical-blue" />
            <p className="text-sm text-white/70">{order.customer_whatsapp}</p>
          </div>
          <a
            href={getWhatsAppLink(order.customer_whatsapp, preOrderWhatsAppGreeting(order))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-tactical-neon/15 border border-tactical-neon/30 text-[10px] font-black uppercase tracking-widest text-tactical-neon hover:bg-tactical-neon/25"
          >
            <Phone className="w-3 h-3" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Product card */}
      {product && (
        <div className="card-tactical p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
            Product
          </p>
          <div className="flex items-start gap-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-14 h-14 rounded-lg object-cover bg-white/5"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center">
                <Package className="w-6 h-6 text-white/30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">{product.name}</p>
              {variant && (
                <p className="text-xs text-white/60">
                  Size: {[variant.size, variant.color].filter(Boolean).join(' / ') || 'Unspecified'}
                </p>
              )}
              <p className="text-[10px] text-white/40 mt-0.5">
                {product.stock_level} in stock now
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing card */}
      <div className="card-tactical p-3 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Pricing
        </p>
        <PriceRow label="Cost" value={formatK(order.unit_cost)} />
        <PriceRow label={`Shipping (${order.shipping_mode})`} value={formatK(order.shipping_cost)} />
        <PriceRow label="Sell price" value={formatK(order.unit_price)} />
        <div className="h-px bg-white/10 my-1" />
        <PriceRow
          label="Deposit (covers cost + shipping)"
          value={formatK(order.deposit_amount)}
          highlight={order.status === 'pending'}
          paid={order.status !== 'pending'}
        />
        <PriceRow
          label="Balance on delivery"
          value={formatK(order.balance_due)}
          highlight={order.status === 'deposit_paid' || order.status === 'arrived'}
        />
        <div className="flex items-center gap-1.5 text-[10px] text-white/40 pt-1">
          <ShippingIcon className="w-3 h-3" />
          {order.shipping_mode === 'air' ? 'Air cargo' : 'Sea cargo'} ·{' '}
          expected by {prettyDate(order.expected_delivery_date)}
        </div>
      </div>

      {/* Action buttons (context-dependent) */}
      {isActive && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
            Actions
          </p>
          {order.status === 'pending' && (
            <ActionButton
              icon={CreditCard}
              label="Record deposit"
              desc={`Customer pays ${formatK(order.deposit_amount)} now`}
              onClick={() => setAction('deposit')}
              primary
            />
          )}
          {order.status === 'deposit_paid' && (
            <ActionButton
              icon={Package}
              label="Mark arrived"
              desc="Use this when the shipment lands at the shop"
              onClick={() => setAction('arrive')}
              primary
            />
          )}
          {order.status === 'arrived' && (
            <ActionButton
              icon={CheckCircle2}
              label="Collect balance + complete sale"
              desc={`Customer pays ${formatK(order.balance_due)} and takes the boots`}
              onClick={() => setAction('convert')}
              primary
            />
          )}
          <ActionButton
            icon={XCircle}
            label="Cancel"
            desc="Forfeit the deposit (or refund as goodwill)"
            onClick={() => setAction('cancel')}
            danger
          />
        </div>
      )}

      {/* Event timeline */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Timeline
        </p>
        <div className="card-tactical p-3 space-y-2.5">
          {events.length === 0 ? (
            <p className="text-xs text-white/40">No events yet.</p>
          ) : (
            events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </div>

      {/* Modals */}
      {action === 'deposit' && (
        <DepositModal
          amount={order.deposit_amount}
          onClose={() => setAction(null)}
          onSubmit={recordDeposit}
          isPending={isPending}
        />
      )}
      {action === 'arrive' && (
        <ConfirmModal
          title="Mark as arrived"
          body="The boots have landed at the shop. The customer can now come in to pay the balance and collect."
          confirmLabel="Yes, mark arrived"
          confirmIcon={Package}
          onClose={() => setAction(null)}
          onConfirm={doMarkArrived}
          isPending={isPending}
        />
      )}
      {action === 'convert' && (
        <ConvertModal
          balanceDue={order.balance_due}
          productName={product?.name ?? 'the boots'}
          onClose={() => setAction(null)}
          onSubmit={doConvert}
          isPending={isPending}
        />
      )}
      {action === 'cancel' && (
        <CancelModal
          depositAmount={order.deposit_amount}
          hasDeposit={order.status !== 'pending'}
          onClose={() => setAction(null)}
          onSubmit={doCancel}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

type ActionKind = 'deposit' | 'arrive' | 'convert' | 'cancel';

function ActionButton({
  icon: Icon,
  label,
  desc,
  onClick,
  primary,
  danger,
}: {
  icon: typeof CreditCard;
  label: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full card-tactical p-3 flex items-center gap-3 text-left transition-colors',
        primary && 'hover:border-tactical-blue/50',
        danger && 'hover:border-tactical-red/50',
        !primary && !danger && 'hover:border-white/20'
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          primary && 'bg-tactical-blue/20 text-tactical-blue',
          danger && 'bg-tactical-red/20 text-tactical-red',
          !primary && !danger && 'bg-white/5 text-white/60'
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-bold',
            danger && 'text-tactical-red'
          )}
        >
          {label}
        </p>
        <p className="text-[10px] text-white/40 leading-tight">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/30" />
    </button>
  );
}

function PriceRow({
  label,
  value,
  highlight = false,
  paid = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  paid?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p
        className={cn(
          'text-xs',
          highlight ? 'text-white font-bold' : 'text-white/60',
          paid && 'line-through text-white/40'
        )}
      >
        {label}
        {paid && <span className="ml-1 text-tactical-neon text-[9px]">paid</span>}
      </p>
      <p
        className={cn(
          'text-sm',
          highlight ? 'font-black text-tactical-neon' : 'font-semibold',
          paid && 'line-through text-white/40'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EventRow({ event }: { event: PreOrderEvent }) {
  const data = (event.event_data ?? {}) as Record<string, unknown>;
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="w-1.5 h-1.5 rounded-full bg-tactical-blue mt-1.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white/80">{labelForEvent(event.event_type, data)}</p>
        <p className="text-[10px] text-white/40">{prettyDateTime(event.created_at)}</p>
        {data.note ? (
          <p className="text-[10px] text-white/60 mt-0.5">{String(data.note)}</p>
        ) : null}
        {typeof data.amount === 'number' ? (
          <p className="text-[10px] text-tactical-neon mt-0.5">
            {formatK(data.amount)} via {String(data.method ?? '')}
          </p>
        ) : null}
        {data.from && data.to ? (
          <p className="text-[10px] text-white/60 mt-0.5">
            {String(data.from)} → {String(data.to)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function labelForEvent(type: string, data: Record<string, unknown>): string {
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
      return 'Completed — customer collected';
    case 'cancelled':
      return `Cancelled${data.reason ? `: ${String(data.reason)}` : ''}`;
    case 'refunded':
      return `Refunded${data.reason ? `: ${String(data.reason)}` : ''}`;
    case 'notified':
      return 'WhatsApp message sent';
    case 'message_queued':
      return 'WhatsApp message queued';
    case 'message_sent':
      return 'WhatsApp message sent';
    case 'status_changed':
      return data.from && data.to
        ? `Status: ${String(data.from)} → ${String(data.to)}`
        : 'Status changed';
    default:
      return type;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="card-tactical w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black uppercase tracking-widest text-white">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-white/40 hover:text-white/70"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DepositModal({
  amount,
  onClose,
  onSubmit,
  isPending,
}: {
  amount: number;
  onClose: () => void;
  onSubmit: (amount: number, method: string, note: string) => void;
  isPending: boolean;
}) {
  const [v, setV] = useState(String(amount));
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');

  return (
    <ModalShell title="Record deposit" onClose={onClose}>
      <p className="text-xs text-white/60">
        Customer pays the deposit. Once recorded, you can place the supplier order.
      </p>
      <Field label={`Amount (deposit is ${formatK(amount)})`}>
        <input
          type="number"
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="input-tactical w-full text-sm"
        />
      </Field>
      <Field label="Method">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="select-tactical w-full text-sm"
        >
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile money</option>
          <option value="bank">Bank transfer</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Note (optional)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Airtel ref 12345"
          className="input-tactical w-full text-sm"
        />
      </Field>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="btn-tactical-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSubmit(Number(v), method, note)}
          disabled={isPending}
          className="btn-tactical flex-1 inline-flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Confirm
        </button>
      </div>
    </ModalShell>
  );
}

function ConvertModal({
  balanceDue,
  productName,
  onClose,
  onSubmit,
  isPending,
}: {
  balanceDue: number;
  productName: string;
  onClose: () => void;
  onSubmit: (method: string) => void;
  isPending: boolean;
}) {
  const [method, setMethod] = useState('cash');
  return (
    <ModalShell title="Complete sale" onClose={onClose}>
      <p className="text-xs text-white/60">
        Customer pays the balance of <strong>{formatK(balanceDue)}</strong> and takes the {productName}.
        A sale row will be created and stock will decrement.
      </p>
      <Field label="Payment method for the balance">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="select-tactical w-full text-sm"
        >
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile money</option>
          <option value="bank">Bank transfer</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-tactical-secondary flex-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSubmit(method)}
          disabled={isPending}
          className="btn-tactical flex-1 inline-flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Complete sale
        </button>
      </div>
    </ModalShell>
  );
}

function CancelModal({
  depositAmount,
  hasDeposit,
  onClose,
  onSubmit,
  isPending,
}: {
  depositAmount: number;
  hasDeposit: boolean;
  onClose: () => void;
  onSubmit: (reason: string, refund: boolean, refundAmount: number, refundMethod: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState(String(depositAmount));
  const [refundMethod, setRefundMethod] = useState('cash');

  return (
    <ModalShell title="Cancel pre-order" onClose={onClose}>
      <p className="text-xs text-white/60">
        {hasDeposit
          ? 'The customer already paid the deposit. You can forfeit it per the terms, or refund as goodwill.'
          : 'No deposit was paid yet, so there is nothing to refund.'}
      </p>
      <Field label="Reason">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer changed mind"
          className="input-tactical w-full text-sm"
        />
      </Field>
      {hasDeposit && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refund}
              onChange={(e) => setRefund(e.target.checked)}
              className="rounded"
            />
            <span>Refund the deposit</span>
          </label>
          {refund && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount">
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="input-tactical w-full text-sm"
                />
              </Field>
              <Field label="Method">
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="select-tactical w-full text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank">Bank</option>
                </select>
              </Field>
            </div>
          )}
        </>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-tactical-secondary flex-1">
          Back
        </button>
        <button
          type="button"
          onClick={() => onSubmit(reason, refund, Number(refundAmount), refundMethod)}
          disabled={isPending || !reason.trim()}
          className="btn-tactical flex-1 inline-flex items-center justify-center gap-2 bg-tactical-red/30 border-tactical-red/50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  onClose,
  onConfirm,
  isPending,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmIcon: typeof CreditCard;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <p className="text-xs text-white/70">{body}</p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-tactical-secondary flex-1">
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="btn-tactical flex-1 inline-flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ConfirmIcon className="w-4 h-4" />}
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

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

function preOrderWhatsAppGreeting(order: PreOrder): string {
  return `Hi ${order.customer_name.split(' ')[0]} — this is Global Essentials following up on your pre-order ${order.tracking_code ?? ''} (${order.shipping_mode === 'air' ? 'air' : 'sea'} cargo, expected ${prettyDate(order.expected_delivery_date)}). `;
}
