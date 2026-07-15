'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Loader2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateOrderStatus, setOrderTracking } from '@/lib/actions/catalog-orders';

/**
 * OrderStatusControls (Phase 8 / 8.5).
 *
 * Client component used on the admin order detail page. Lets the
 * shop owner:
 *   1. Advance the order through the workflow:
 *      pending -> confirmed -> processing -> shipped -> delivered
 *   2. Cancel the order (with stock restoration, handled server-side)
 *   3. Set the shipping tracking number (auto-advances to 'shipped'
 *      if the order was pre-ship)
 *
 * After every change, we refresh the route so the rest of the
 * page re-renders with the new state.
 */

interface OrderStatusControlsProps {
  orderId: string;
  currentStatus: string;
  currentTracking: string | null;
}

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
type StatusValue = typeof STATUS_FLOW[number] | 'cancelled';

const STATUS_LABELS: Record<StatusValue, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function OrderStatusControls({
  orderId,
  currentStatus,
  currentTracking,
}: OrderStatusControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingInput, setTrackingInput] = useState(currentTracking ?? '');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const currentIdx = STATUS_FLOW.indexOf(currentStatus as typeof STATUS_FLOW[number]);
  const isCancelled = currentStatus === 'cancelled';
  const isFinal = currentStatus === 'delivered' || isCancelled;

  function applyStatus(next: StatusValue) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const label = STATUS_LABELS[next];
      toast.success(`Order marked as ${label}`);
      router.refresh();
    });
  }

  function applyTracking() {
    const trimmed = trackingInput.trim();
    if (!trimmed) {
      toast.error('Enter a tracking number first.');
      return;
    }
    if (trimmed === currentTracking) {
      toast.message('Tracking number is unchanged.');
      return;
    }
    startTransition(async () => {
      const res = await setOrderTracking(orderId, trimmed);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Tracking number saved');
      router.refresh();
    });
  }

  if (isCancelled) {
    return (
      <div className="card-tactical border-tactical-red/30 bg-tactical-red/5 p-4">
        <p className="text-sm font-black text-tactical-red">Order cancelled</p>
        <p className="text-xs text-white/60 mt-1">
          Stock for the items in this order has been restored.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status flow stepper */}
      <div className="card-tactical space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
          Workflow
        </p>
        <div className="space-y-2">
          {STATUS_FLOW.map((status, i) => {
            const isComplete = i <= currentIdx;
            const isCurrent = status === currentStatus;
            const isNext = i === currentIdx + 1;
            return (
              <div
                key={status}
                className="flex items-center gap-3"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                    isComplete
                      ? 'bg-tactical-neon text-black'
                      : 'bg-white/5 border border-white/10 text-white/30'
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-[10px] font-black">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-bold',
                      isCurrent ? 'text-tactical-neon' : isComplete ? 'text-white/70' : 'text-white/40'
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </p>
                  {isCurrent && (
                    <p className="text-[10px] text-white/50">Current status</p>
                  )}
                </div>
                {isNext && !isFinal && (
                  <button
                    type="button"
                    onClick={() => applyStatus(status)}
                    disabled={isPending}
                    className="px-3 h-8 rounded-lg bg-tactical-blue/20 border border-tactical-blue/40 text-tactical-blue text-[10px] font-black uppercase tracking-widest hover:bg-tactical-blue/30 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Advance'}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracking number */}
      <div className="card-tactical space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-tactical-blue" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Shipping tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Courier tracking number"
            className="flex-1 h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:border-tactical-blue focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={applyTracking}
            disabled={isPending || !trackingInput.trim()}
            className="px-3 h-10 rounded-lg bg-tactical-blue/20 border border-tactical-blue/40 text-tactical-blue text-[10px] font-black uppercase tracking-widest hover:bg-tactical-blue/30 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </div>
        {currentTracking && currentTracking === trackingInput.trim() && (
          <p className="text-[10px] text-white/40">
            Current tracking: <span className="font-mono">{currentTracking}</span>
          </p>
        )}
      </div>

      {/* Cancel */}
      {!isFinal && (
        <div className="card-tactical border-tactical-red/20 p-3 space-y-2">
          {!showCancelConfirm ? (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full h-10 rounded-lg bg-tactical-red/10 border border-tactical-red/30 text-tactical-red text-[11px] font-black uppercase tracking-widest hover:bg-tactical-red/20 flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Cancel this order
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-tactical-red font-bold">
                Cancel and restore stock? This can&apos;t be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyStatus('cancelled')}
                  disabled={isPending}
                  className="flex-1 h-9 rounded-lg bg-tactical-red text-white text-[11px] font-black uppercase tracking-widest hover:bg-tactical-red/90 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                  Yes, cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isPending}
                  className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[11px] font-black uppercase tracking-widest hover:bg-white/10"
                >
                  Keep order
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
