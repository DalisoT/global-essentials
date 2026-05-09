'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { CashFlowImpact } from '@/lib/import/advisor-types';
import { TrendingUp, ArrowRight } from 'lucide-react';

interface CashFlowImpactProps {
  impact: CashFlowImpact;
}

export function CashFlowImpact({ impact }: CashFlowImpactProps) {
  const {
    revenueDelayDays,
    dailyImpact,
    totalAirCashFlow,
    totalSeaCashFlow,
    breakevenDay,
    airPremiumCost,
  } = impact;

  const maxCumulative = Math.max(...dailyImpact.map(d => d.cumulativeAir), ...dailyImpact.map(d => d.cumulativeSea));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Cash Flow Impact
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/50 mb-1">Air Revenue (30d)</div>
          <div className="text-lg font-bold text-tactical-neon">
            {formatCurrency(totalAirCashFlow)}
          </div>
        </div>
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/50 mb-1">Sea Revenue (30d)</div>
          <div className="text-lg font-bold text-tactical-orange">
            {formatCurrency(totalSeaCashFlow)}
          </div>
        </div>
      </div>

      {/* Air Premium */}
      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
        <div>
          <div className="text-xs text-white/50">Air Premium Cost</div>
          <div className="text-sm font-bold text-tactical-red">+{formatCurrency(airPremiumCost)}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-white/30" />
        <div className="text-right">
          <div className="text-xs text-white/50">Revenue Delay</div>
          <div className="text-sm font-bold text-tactical-orange">{revenueDelayDays} days</div>
        </div>
      </div>

      {/* Breakeven Day */}
      {breakevenDay !== null ? (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
          <TrendingUp className="w-4 h-4 shrink-0" />
          <div>
            <div className="text-xs font-bold">Cash Flow Breakeven</div>
            <div className="text-sm">
              Air catches up by <span className="font-bold">Day {breakevenDay}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
          <p className="text-xs text-white/50">
            Sea revenue doesn&apos;t recover within 30 days — air premium not recovered
          </p>
        </div>
      )}

      {/* Simple bar chart — cumulative cash flow by day */}
      <div className="space-y-1">
        <div className="text-xs text-white/40 mb-2">Cumulative Cash Flow (sampled)</div>
        {[1, 10, 20, 30].map(day => {
          const d = dailyImpact.find(d => d.day === day) || dailyImpact[day - 1];
          if (!d) return null;
          const airWidth = maxCumulative > 0 ? (d.cumulativeAir / maxCumulative) * 100 : 0;
          const seaWidth = maxCumulative > 0 ? (d.cumulativeSea / maxCumulative) * 100 : 0;
          return (
            <div key={day} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-white/40 text-right font-mono">D{day}</span>
              <div className="flex-1 h-4 bg-white/5 rounded relative">
                <div
                  className="h-full bg-tactical-neon/60 rounded-l absolute left-0 top-0"
                  style={{ width: `${airWidth}%` }}
                  title={`Air: ${formatCurrency(d.cumulativeAir)}`}
                />
                <div
                  className="h-full bg-tactical-orange/40 rounded-l absolute top-0"
                  style={{ width: `${seaWidth}%`, left: 0 }}
                  title={`Sea: ${formatCurrency(d.cumulativeSea)}`}
                />
              </div>
              <span className="w-20 text-white/50 font-mono text-right">
                A:{formatCurrency(d.cumulativeAir)} S:{formatCurrency(d.cumulativeSea)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
