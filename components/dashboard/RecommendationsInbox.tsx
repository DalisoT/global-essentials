import Link from 'next/link';
import { Sparkles, X, Check, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  getPendingRecommendationCount,
  listRecommendations,
} from '@/lib/actions/recommendations';
import { RecommendationsInboxActions } from './RecommendationsInboxActions';
import type { AIRecommendation, AIRecommendationPriority } from '@/lib/supabase-types';

/**
 * RecommendationsInbox (Phase 9 / 9.1 + 9.2).
 *
 * Server component. Mounted on the (pos) dashboard. Shows the
 * user's pending AI recommendations in priority order. Each row
 * has Accept / Dismiss / Acted buttons (client component) +
 * a chevron link to the source (e.g. the product page for a
 * reorder alert, the dashboard for a cashflow warning).
 *
 * Renders a happy "all caught up" state when there are no
 * pending recommendations. Renders nothing if the list call
 * fails — the dashboard should not break.
 */

const PRIORITY_STYLES: Record<AIRecommendationPriority, string> = {
  high: 'border-tactical-red/30 bg-tactical-red/5',
  medium: 'border-tactical-orange/30 bg-tactical-orange/5',
  low: 'border-white/10 bg-white/[0.03]',
};

const PRIORITY_BADGES: Record<AIRecommendationPriority, string> = {
  high: 'bg-tactical-red/20 text-tactical-red',
  medium: 'bg-tactical-orange/20 text-tactical-orange',
  low: 'bg-white/10 text-white/50',
};

const KIND_LABELS: Record<string, string> = {
  reorder_alert: 'Reorder',
  cashflow_warning: 'Cashflow',
  anomaly: 'Anomaly',
  weekly_briefing: 'Briefing',
  goal_progress: 'Goal',
  forecast_alert: 'Forecast',
  custom: 'Insight',
};

export async function RecommendationsInbox({ limit = 5 }: { limit?: number }) {
  const [countRes, listRes] = await Promise.all([
    getPendingRecommendationCount(),
    listRecommendations({ status: 'pending', limit }),
  ]);

  if (countRes.error || listRes.error) {
    // Fail silently — the dashboard must not break.
    return null;
  }

  const count = countRes.data ?? { total: 0, high: 0, medium: 0, low: 0 };
  const items = listRes.data ?? [];

  if (items.length === 0) {
    return (
      <div className="card-tactical border-tactical-neon/30 bg-tactical-neon/5 p-3 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-tactical-neon" />
        <div>
          <p className="text-sm font-bold text-tactical-neon">All caught up</p>
          <p className="text-[10px] text-white/50">No AI suggestions waiting on you right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-tactical-purple" />
        <h2 className="text-sm font-black uppercase tracking-widest text-white/60">
          AI suggestions
        </h2>
        {count.total > 0 && (
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
              count.high > 0
                ? 'bg-tactical-red/20 text-tactical-red'
                : count.medium > 0
                  ? 'bg-tactical-orange/20 text-tactical-orange'
                  : 'bg-white/10 text-white/50'
            }`}
          >
            {count.total}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {items.map((r: AIRecommendation) => (
          <RecommendationRow key={r.id} rec={r} />
        ))}
        {count.total > items.length && (
          <Link
            href="/inbox"
            className="text-[10px] font-black uppercase tracking-widest text-tactical-blue hover:text-tactical-neon transition-colors inline-flex items-center gap-1"
          >
            View all {count.total} suggestions
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: AIRecommendation }) {
  return (
    <div
      className={`card-tactical p-3 border ${PRIORITY_STYLES[rec.priority]}`}
    >
      <div className="flex items-start gap-2">
        {rec.priority === 'high' && (
          <AlertTriangle className="w-4 h-4 text-tactical-red shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${PRIORITY_BADGES[rec.priority]}`}
            >
              {KIND_LABELS[rec.kind] ?? rec.kind}
            </span>
            <p className="font-bold text-sm leading-tight">{rec.title}</p>
          </div>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">{rec.body}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <RecommendationsInboxActions recId={rec.id} sourceAction={rec.source_action} relatedId={rec.related_id} />
          </div>
        </div>
        <Link
          href={resolveHref(rec)}
          className="shrink-0 p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Open source"
        >
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
        </Link>
      </div>
    </div>
  );
}

function resolveHref(rec: AIRecommendation): string {
  // Best-effort link to the source. If we don't know what the
  // related entity is, default to the dashboard.
  switch (rec.kind) {
    case 'reorder_alert':
    case 'forecast_alert':
      return rec.related_id ? `/inventory/forecast` : '/inventory';
    case 'cashflow_warning':
      return '/dashboard';
    case 'goal_progress':
      return '/dashboard';
    case 'anomaly':
      return rec.related_id ? `/orders/${rec.related_id}` : '/dashboard';
    case 'weekly_briefing':
      return '/inbox';
    default:
      return '/dashboard';
  }
}

// X / Check imports are used by the client component (Actions).
void X;
void Check;
