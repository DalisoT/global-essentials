'use client';

import { useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { forecastDemand } from '@/lib/actions/forecast';
import type { DemandForecastPayload } from '@/lib/supabase-types';

/**
 * ForecastListRow (Phase 7 / 7.6).
 *
 * Client component used inside the server-rendered
 * `/inventory/forecast` page. Each row shows the product name +
 * current stock + a "Generate forecast" button. On click, the row
 * fetches `forecastDemand(productId, 30)` and shows the predicted
 * 30-day demand + a small inline chart.
 *
 * Why client-side fetch (not server-side):
 *   - The inventory list can be hundreds of products. Pre-computing
 *     a forecast for every row at request time would be too slow.
 *   - Forecasts are cached in the `forecasts` table (TTL 1 day), so
 *     the first click on a row is the only slow one — subsequent
 *     clicks on the same product (even from a different page) are
 *     instant.
 *   - The table of product sales is large; we don't want to
 *     aggregate it on every page load.
 */

interface ForecastListRowProps {
  productId: string;
  name: string;
  currentStock: number;
  costPrice?: number | null;
  sellingPrice?: number | null;
}

type State = 'idle' | 'loading' | 'shown' | 'error';

export function ForecastListRow({
  productId,
  name,
  currentStock,
  costPrice,
  sellingPrice: _sellingPrice,
}: ForecastListRowProps) {
  const [state, setState] = useState<State>('idle');
  const [forecast, setForecast] = useState<DemandForecastPayload | null>(null);

  const handleClick = async () => {
    if (state === 'loading') return;
    setState('loading');
    const res = await forecastDemand(productId, 30);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't generate forecast.");
      setState('error');
      return;
    }
    setForecast(res.data.payload as unknown as DemandForecastPayload);
    setState('shown');
  };

  // Days-of-stock = current stock / (predicted_qty / 30). Useful
  // highlight: if days-of-stock < 14, the row tints orange.
  const avgDaily = forecast && forecast.series.length > 0
    ? forecast.series.reduce((a, b) => a + b.predicted_qty, 0) / forecast.series.length
    : 0;
  const totalPredicted = forecast ? forecast.series.reduce((a, b) => a + b.predicted_qty, 0) : 0;
  const daysOfStock = avgDaily > 0 ? currentStock / avgDaily : Infinity;
  const stockStatus =
    daysOfStock < 7 ? 'critical' : daysOfStock < 14 ? 'low' : daysOfStock < 60 ? 'ok' : 'overstocked';

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4">
        <p className="font-bold text-sm">{name}</p>
        {costPrice != null && (
          <p className="text-[10px] text-white/40 mt-0.5">
            Cost: {formatCurrency(costPrice)}
          </p>
        )}
      </td>
      <td className="py-3 px-4 text-right text-sm font-bold">{currentStock}</td>
      <td className="py-3 px-4 text-right">
        {state === 'idle' || state === 'error' ? (
          <button
            type="button"
            onClick={handleClick}
            className="text-[10px] font-black uppercase tracking-widest text-tactical-blue hover:text-tactical-neon transition-colors"
          >
            {state === 'error' ? 'Retry' : 'Forecast →'}
          </button>
        ) : state === 'loading' ? (
          <Loader2 className="w-4 h-4 text-tactical-blue animate-spin inline" />
        ) : forecast ? (
          <div className="space-y-1">
            <p className="text-sm font-black text-tactical-neon">
              {totalPredicted.toFixed(0)} units
            </p>
            <p className="text-[10px] text-white/40">
              {forecast.method_label} · conf {Math.round(forecast.confidence * 100)}%
            </p>
          </div>
        ) : null}
      </td>
      <td className="py-3 px-4">
        {state === 'shown' && forecast && (
          <StockBadge status={stockStatus} daysOfStock={daysOfStock} />
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function StockBadge({
  status,
  daysOfStock,
}: {
  status: 'critical' | 'low' | 'ok' | 'overstocked';
  daysOfStock: number;
}) {
  const styles: Record<typeof status, string> = {
    critical: 'bg-tactical-red/20 text-tactical-red border-tactical-red/30',
    low: 'bg-tactical-orange/20 text-tactical-orange border-tactical-orange/30',
    ok: 'bg-tactical-neon/20 text-tactical-neon border-tactical-neon/30',
    overstocked: 'bg-tactical-blue/20 text-tactical-blue border-tactical-blue/30',
  };
  const labels: Record<typeof status, string> = {
    critical: 'Stockout risk',
    low: 'Reorder soon',
    ok: 'Healthy',
    overstocked: 'Overstocked',
  };
  const icons: Record<typeof status, React.ReactNode> = {
    critical: <TrendingDown className="w-3 h-3" />,
    low: <TrendingDown className="w-3 h-3" />,
    ok: <TrendingUp className="w-3 h-3" />,
    overstocked: <Minus className="w-3 h-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${styles[status]}`}
    >
      {icons[status]}
      {labels[status]}
      <span className="opacity-60 font-normal normal-case tracking-normal">
        ({daysOfStock === Infinity ? '∞' : daysOfStock.toFixed(0)}d)
      </span>
    </span>
  );
}
