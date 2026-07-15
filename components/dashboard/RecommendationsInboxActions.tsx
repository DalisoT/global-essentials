'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  updateRecommendationStatus,
} from '@/lib/actions/recommendations';

/**
 * RecommendationsInboxActions (Phase 9 / 9.2).
 *
 * The accept / dismiss / acted_on button group for one
 * recommendation row. Three small buttons:
 *
 *   - Dismiss (X)  → status: dismissed, dismissed_at = now()
 *   - Accept (✓)   → status: accepted,  acted_on_at = now()
 *   - Acted (Zap)  → status: acted_on,  acted_on_at = now()
 *
 * After every change we refresh the page so the count + the
 * list re-render. Accept and Acted are subtly different:
 *   - Accept = "this suggestion was useful, keep showing me these"
 *   - Acted  = "I actually did the thing you suggested"
 *
 * The distinction matters for the memory layer (9.6) — a high
 * acted_on rate on a kind means the user is engaging with it.
 */

interface RecommendationsInboxActionsProps {
  recId: string;
  sourceAction: string | null;
  relatedId: string | null;
}

export function RecommendationsInboxActions({
  recId,
  sourceAction: _sourceAction,
  relatedId: _relatedId,
}: RecommendationsInboxActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function apply(status: 'dismissed' | 'accepted' | 'acted_on') {
    if (isPending) return;
    // Optimistic: hide the row immediately.
    setHidden(true);
    startTransition(async () => {
      const res = await updateRecommendationStatus(recId, status);
      if (res.error) {
        toast.error(res.error);
        // Roll back: re-show the row.
        setHidden(false);
        return;
      }
      const labels = {
        dismissed: 'Dismissed',
        accepted: 'Marked as useful',
        acted_on: 'Marked as acted on',
      } as const;
      toast.success(labels[status]);
      router.refresh();
    });
  }

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => apply('dismissed')}
        disabled={isPending}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-50"
        title="Dismiss"
      >
        <X className="w-3 h-3" />
        Dismiss
      </button>
      <button
        type="button"
        onClick={() => apply('accepted')}
        disabled={isPending}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-tactical-blue/15 border border-tactical-blue/30 text-[10px] font-black uppercase tracking-widest text-tactical-blue hover:bg-tactical-blue/25 transition-colors disabled:opacity-50"
        title="Mark as useful"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Useful
      </button>
      <button
        type="button"
        onClick={() => apply('acted_on')}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50',
          'bg-tactical-neon/15 border border-tactical-neon/30 text-tactical-neon hover:bg-tactical-neon/25'
        )}
        title="I did the thing"
      >
        <Zap className="w-3 h-3" />
        Did it
      </button>
    </>
  );
}
