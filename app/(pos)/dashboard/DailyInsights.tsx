'use client';

import { useEffect, useState, useTransition } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, CheckCircle2, Info } from 'lucide-react';
import { getDailyInsights, type DailyInsights, type DailyInsight } from '@/lib/actions/insights';

const toneStyles: Record<DailyInsight['tone'], { icon: typeof Sparkles; color: string; ring: string }> = {
  action:   { icon: AlertTriangle, color: 'text-tactical-orange',  ring: 'border-tactical-orange/30 bg-tactical-orange/10' },
  warning:  { icon: AlertTriangle, color: 'text-tactical-red',     ring: 'border-tactical-red/30 bg-tactical-red/10' },
  positive: { icon: CheckCircle2,  color: 'text-tactical-neon',    ring: 'border-tactical-neon/30 bg-tactical-neon/10' },
  info:     { icon: Info,          color: 'text-tactical-blue',    ring: 'border-tactical-blue/30 bg-tactical-blue/10' },
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DailyInsightsWidget({ initial }: { initial?: DailyInsights }) {
  const [data, setData] = useState<DailyInsights | null>(initial ?? null);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If we got no SSR data (build/render race), fetch once on mount.
  useEffect(() => {
    if (data) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const result = await getDailyInsights();
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data) setData(result.data);
    });
  }

  if (error) {
    return (
      <div className="card-tactical border border-tactical-red/30">
        <p className="text-sm text-tactical-red">Couldn{'\''}t load today{'\''}s insights.</p>
        <button onClick={refresh} className="text-xs uppercase tracking-wide text-white/60 mt-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card-tactical relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-tactical-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-tactical-blue" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              What to do today
            </h2>
            {data?.source === 'fallback' && (
              <span className="text-[10px] uppercase tracking-wide text-white/40 ml-1">
                (offline summary)
              </span>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 disabled:opacity-50"
            aria-label="Refresh insights"
            title="Refresh insights"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {data ? (
          <>
            <ul className="space-y-2">
              {data.bullets.map((b, i) => {
                const s = toneStyles[b.tone] ?? toneStyles.info;
                const Icon = s.icon;
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${s.ring}`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.color}`} />
                    <p className="text-sm text-white/90 leading-snug">{b.text}</p>
                  </li>
                );
              })}
            </ul>
            <p className="text-[10px] uppercase tracking-wider text-white/40 pt-1">
              Updated {timeAgo(data.generatedAt)}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2 py-4 text-white/40 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading today{'\''}s insights…
          </div>
        )}
      </div>
    </div>
  );
}