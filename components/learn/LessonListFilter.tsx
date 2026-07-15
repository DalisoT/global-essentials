'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { cn } from '@/lib/utils';

/**
 * LessonListFilter (Phase 4 / 4D.2).
 *
 * Three filter chips for the pillar lesson list:
 *   - All        (default)
 *   - Unread     (no completed_at)
 *   - Bookmarked (bookmarked === true)
 *
 * Filters are URL-driven so the server component can read the same
 * param on refresh / share. We use `router.replace` + `scroll: false`
 * to keep scroll position and avoid pushing a new history entry.
 *
 * Server-side filtering means we never send the full lesson list to
 * the client just to hide it; the URL is the source of truth.
 */

export type LessonFilter = 'all' | 'unread' | 'bookmarked';

const FILTERS: Array<{ id: LessonFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'bookmarked', label: 'Bookmarked' },
];

export function LessonListFilter({
  active,
  counts,
}: {
  active: LessonFilter;
  /** Optional counts for each filter. If omitted, no count badge. */
  counts?: Partial<Record<LessonFilter, number>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = useCallback(
    (filter: LessonFilter) => {
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
        'flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/5',
        isPending && 'opacity-70 transition-opacity'
      )}
      role="tablist"
      aria-label="Filter lessons"
    >
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        const count = counts?.[f.id];
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(f.id)}
            className={cn(
              'flex-1 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors',
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
