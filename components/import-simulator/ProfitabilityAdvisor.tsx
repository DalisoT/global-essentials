'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { ProfitabilityAdvice } from '@/lib/import/advisor-types';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface ProfitabilityAdvisorProps {
  advice: ProfitabilityAdvice;
  onApplyPrice: (price: number) => void;
}

export function ProfitabilityAdvisor({ advice, onApplyPrice }: ProfitabilityAdvisorProps) {
  const {
    suggestedSellingPrice,
    targetMarginPercent,
    costPerUnitLocal,
    marketAveragePrice,
    isBelowMarketAverage,
    marketAlert,
    aiMarketIntelligence,
  } = advice;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Profitability Advisor
      </h3>

      {/* Suggested Price */}
      <div className="p-3 bg-tactical-neon/10 border border-tactical-neon/30 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/50">Suggested Selling Price</span>
          <span className="text-xs text-white/50">{targetMarginPercent}% margin target</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-tactical-neon">
            {formatCurrency(suggestedSellingPrice)}
          </span>
          <button
            onClick={() => onApplyPrice(suggestedSellingPrice)}
            className="px-3 py-1.5 text-xs font-bold bg-tactical-neon text-black rounded-lg hover:bg-tactical-neon/80 transition-colors"
          >
            Use This Price
          </button>
        </div>
      </div>

      {/* Cost Context */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/50">Landed Cost/Unit</span>
        <span className="font-semibold">{formatCurrency(costPerUnitLocal)}</span>
      </div>

      {/* Market Comparison */}
      {marketAveragePrice !== null && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-xl border',
          isBelowMarketAverage
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        )}>
          {isBelowMarketAverage ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-xs font-bold uppercase">Market Check</div>
            <div className="text-sm">
              Market avg: {formatCurrency(marketAveragePrice)} — your price {isBelowMarketAverage ? 'below' : 'at or above'} market
            </div>
          </div>
        </div>
      )}

      {/* Alert */}
      {marketAlert && (
        <div className="flex items-start gap-2 p-3 bg-tactical-red/10 border border-tactical-red/30 rounded-xl text-tactical-red">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">{marketAlert}</p>
        </div>
      )}

      {/* AI Insight */}
      {aiMarketIntelligence && (
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3 h-3 text-white/40" />
            <span className="text-xs text-white/40">Market Insight</span>
          </div>
          <p className="text-xs text-white/60 italic">{aiMarketIntelligence}</p>
        </div>
      )}
    </div>
  );
}
