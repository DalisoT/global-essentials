'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { cn } from '@/lib/utils';

/**
 * OrdersFilter (Phase 8 / 8.5).
 *
 * URL-driven filter chips for the admin orders list. Clicking a
 * chip updates the `?filter=` search param; the server component
 * re-runs the query. The active chip is tinted; counts are shown
 * inline so the shop owner can see how many orders are in each
 * state at a glance.
 */

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function OrdersFilter({
  active,
  counts,
}: {
  active: string;
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = useCallback(
    (filter: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (filter === 'all') {
        params.delete('filter');
      } else {
        params.set('filter', filter);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `?${qs}` : '?', { scroll: false });
      });
    },
    [router, searchParams]
  );

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/5 overflow-x-auto',
        isPending && 'opacity-70 transition-opacity'
      )}
      role="tablist"
      aria-label="Filter orders by status"
    >
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(f.id)}
            className={cn(
              'shrink-0 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            <span>{f.label}</span>
            {typeof count === 'number' && (
              <span
                className={cn(
                  'ml-1.5 text-[9px] font-bold',
                  isActive ? 'text-white/60' : 'text-white/30'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
