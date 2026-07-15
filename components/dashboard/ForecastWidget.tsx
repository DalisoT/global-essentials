import Link from 'next/link';
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { forecastCashFlow } from '@/lib/actions/forecast';
import type { CashflowForecastPayload } from '@/lib/supabase-types';

/**
 * ForecastWidget (Phase 7 / 7.5).
 *
 * Server component. Renders a "Next 30 days" cash forecast card on
 * the dashboard. The card shows:
 *   - Big number: end-of-horizon cash position
 *   - A sparkline of cumulative cash over the 30 days
 *   - The min_cash day + its amount (in red if it goes below 0)
 *   - "Ask AI CFO" chip for deeper analysis
 *
 * Data flow:
 *   forecastCashFlow(30) -> Forecast row (cached in `forecasts` table
 *   for 1 day) -> render.
 *
 * If the cache is cold and the computation fails, we render an
 * "unavailable" empty state instead of throwing — the dashboard
 * must not break if forecasting is broken.
 */

interface ForecastWidgetProps {
  /** Optional horizon override; defaults to 30. */
  days?: number;
  /** Optional AskCfoChip prefill text. */
  cfoPrefill?: string;
}

export async function ForecastWidget({
  days = 30,
  cfoPrefill = "Project my cash position for the next 30 days. What day am I lowest, and what can I do about it?",
}: ForecastWidgetProps) {
  const res = await forecastCashFlow(days);
  if (res.error || !res.data) {
    // Render an empty state so the dashboard doesn't break.
    return (
      <div className="card-tactical border-tactical-blue/20 p-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
          <Sparkles className="w-3 h-3" />
          Forecast
        </div>
        <p className="text-sm text-white/40 mt-2">
          Cash forecast unavailable right now. Try again in a minute.
        </p>
      </div>
    );
  }

  const payload = res.data.payload as unknown as CashflowForecastPayload;
  const series = payload.series ?? [];
  const endCash = payload.end_cash;
  const minCash = payload.min_cash_amount;
  const minDay = payload.min_cash_day;
  const minDayShort = formatShortDate(minDay);
  const goingNegative = minCash < 0;
  const trendDown = endCash < (series[0]?.cumulative ?? endCash);

  return (
    <div className="card-tactical relative overflow-hidden border-tactical-blue/30">
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-tactical-blue/15 rounded-full blur-3xl" />
      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
          <Sparkles className="w-3 h-3 text-tactical-blue" />
          Next {days} days
          <span className="text-white/20">·</span>
          <span>Cash forecast</span>
        </div>

        {/* End-of-horizon big number */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
              Projected cash
            </p>
            <p
              className={`text-3xl font-black tracking-tighter ${
                endCash < 0 ? 'text-tactical-red' : 'text-tactical-neon'
              }`}
            >
              {formatCurrency(endCash)}
            </p>
            <p className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
              {trendDown ? (
                <TrendingDown className="w-3 h-3 text-tactical-orange" />
              ) : (
                <TrendingUp className="w-3 h-3 text-tactical-neon" />
              )}
              {series.length} day projection
            </p>
          </div>

          {/* Sparkline */}
          <Sparkline series={series.map((p) => p.cumulative)} />
        </div>

        {/* Min cash day */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
            goingNegative
              ? 'bg-tactical-red/10 border border-tactical-red/30 text-tactical-red'
              : 'bg-white/5 border border-white/10 text-white/60'
          }`}
        >
          {goingNegative && <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div className="flex-1 min-w-0">
            {goingNegative ? (
              <p className="font-bold">
                Projected to go negative around {minDayShort}
              </p>
            ) : (
              <p className="font-bold text-white/80">Tightest point: {minDayShort}</p>
            )}
            <p className="text-[10px] opacity-80">
              Lowest cash: {formatCurrency(minCash)}
              <span className="opacity-50">
                {' '}
                · In: {formatCurrency(payload.total_inflow)} · Out:{' '}
                {formatCurrency(payload.total_outflow)}
              </span>
            </p>
          </div>
        </div>

        {/* Ask CFO CTA */}
        <Link
          href={`/cfo?prefill=${encodeURIComponent(cfoPrefill)}`}
          className="text-[10px] font-black uppercase tracking-widest text-tactical-blue hover:text-tactical-neon transition-colors flex items-center gap-1"
        >
          Ask AI CFO →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sparkline (pure SVG, no chart lib)
// ─────────────────────────────────────────────────────────────────────

function Sparkline({ series, width = 120, height = 48 }: { series: number[]; width?: number; height?: number }) {
  if (series.length === 0) return <div style={{ width, height }} />;
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 1);
  const range = max - min || 1;
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;

  const points = series
    .map((v, i) => {
      const x = i * stepX;
      // Invert y because SVG y grows down
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastVal = series[series.length - 1];
  const lastY = height - ((lastVal - min) / range) * (height - 4) - 2;
  const isNegative = lastVal < 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isNegative ? 'rgb(239, 68, 68)' : 'rgb(74, 222, 128)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={lastY}
        r="2.5"
        fill={isNegative ? 'rgb(239, 68, 68)' : 'rgb(74, 222, 128)'}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Date helper
// ─────────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  // iso is YYYY-MM-DD. Convert to "Fri 12 Jul" style.
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
}
