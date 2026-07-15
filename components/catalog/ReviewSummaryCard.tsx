import { Quote, Sparkles, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { summarizeReviews } from '@/lib/actions/catalog';
import type { ReviewSummaryPayload } from '@/lib/supabase-types';

/**
 * ReviewSummaryCard (Phase 8 / 8.6).
 *
 * Server component. Calls summarizeReviews(productId) and renders
 * the AI-distilled themes + a couple of verbatim quotes above the
 * raw review list on the product detail page.
 *
 * The action is cached (1-day TTL via the existing forecasts
 * table) so most page loads return a cached summary with no
 * Groq call. Falls back to an empty state if there are no
 * reviews yet.
 *
 * Renders NOTHING if the action errors out — the raw reviews
 * list is still there as a fallback, the summary is a progressive
 * enhancement.
 */
export async function ReviewSummaryCard({ productId }: { productId: string }) {
  const res = await summarizeReviews(productId);
  if (res.error || !res.data) {
    // Don't render anything if the summary fails. The raw
    // review list below is the source of truth.
    return null;
  }

  const { payload, cached } = res.data;
  if (payload.reviewCount === 0) {
    return null; // No reviews — let the empty state below speak.
  }

  return (
    <div className="card-tactical border-tactical-purple/20 bg-tactical-purple/[0.04] space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-tactical-purple" />
        <p className="text-sm font-black uppercase tracking-widest text-tactical-purple">
          What customers are saying
        </p>
        {cached && (
          <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest ml-auto">
            · cached summary
          </span>
        )}
      </div>

      {/* Overall */}
      <p className="text-sm text-white/90 leading-relaxed">{payload.overall}</p>

      {/* Themes */}
      {payload.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {payload.themes.map((t: ReviewSummaryPayload['themes'][number], i: number) => {
            const Icon =
              t.sentiment === 'positive' ? ThumbsUp
                : t.sentiment === 'negative' ? ThumbsDown
                  : Minus;
            const cls =
              t.sentiment === 'positive'
                ? 'bg-tactical-neon/15 border-tactical-neon/30 text-tactical-neon'
                : t.sentiment === 'negative'
                  ? 'bg-tactical-red/15 border-tactical-red/30 text-tactical-red'
                  : 'bg-white/5 border-white/10 text-white/60';
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${cls}`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Quotes */}
      {payload.quotes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-tactical-purple/15">
          {payload.quotes.map((q: string, i: number) => (
            <div key={i} className="flex gap-2 text-sm text-white/80 italic">
              <Quote className="w-4 h-4 text-tactical-purple/60 shrink-0 mt-0.5" />
              <p className="leading-relaxed">&ldquo;{q}&rdquo;</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-white/30 pt-1">
        Distilled from {payload.reviewCount} approved review
        {payload.reviewCount === 1 ? '' : 's'} · refreshed daily
      </p>
    </div>
  );
}
