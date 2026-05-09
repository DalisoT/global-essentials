'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { BreakEvenResult } from '@/lib/import/advisor-types';
import { Calculator, ArrowRight, Info } from 'lucide-react';

interface BreakEvenCalculatorProps {
  result: BreakEvenResult;
}

export function BreakEvenCalculator({ result }: BreakEvenCalculatorProps) {
  const {
    minQuantityForAirWorthwhile,
    airPremiumPerUnit,
    seaCostPerUnit,
    airCostPerUnit,
    isAirWorthwhileAtQuantity,
    currentQuantityRecommendation,
    formulaExplanation,
  } = result;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Break-Even Analysis
      </h3>

      {/* Key Number */}
      <div className="p-4 bg-tactical-neon/10 border border-tactical-neon/30 rounded-xl text-center">
        <div className="text-xs text-white/50 mb-1">Min Quantity for Air Worthwhile</div>
        <div className="text-3xl font-bold text-tactical-neon">
          {minQuantityForAirWorthwhile}
          <span className="text-lg text-white/50 ml-2">units</span>
        </div>
      </div>

      {/* Cost Comparison */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/40 mb-1">Sea Cost/Unit</div>
          <div className="font-bold text-tactical-orange">{formatCurrency(seaCostPerUnit)}</div>
        </div>
        <div className="flex items-center justify-center">
          <ArrowRight className="w-4 h-4 text-white/30" />
        </div>
        <div className="p-2 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/40 mb-1">Air Cost/Unit</div>
          <div className="font-bold text-tactical-red">{formatCurrency(airCostPerUnit)}</div>
        </div>
      </div>

      {/* Air Premium */}
      <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/10">
        <span className="text-sm text-white/60">Air Premium/Unit</span>
        <span className="font-bold text-tactical-red">+{formatCurrency(airPremiumPerUnit)}</span>
      </div>

      {/* Recommendation */}
      <div className={cn(
        'p-3 rounded-xl border text-sm',
        isAirWorthwhileAtQuantity
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-white/5 border-white/10 text-white/70'
      )}>
        {currentQuantityRecommendation}
      </div>

      {/* Formula Explanation */}
      <details className="group">
        <summary className="flex items-center gap-2 text-xs text-white/40 cursor-pointer hover:text-white/60">
          <Info className="w-3 h-3" />
          <Calculator className="w-3 h-3" />
          Show formula
        </summary>
        <div className="mt-2 p-3 bg-black/30 rounded-xl">
          <pre className="text-xs text-white/50 whitespace-pre-wrap font-mono">
            {formulaExplanation}
          </pre>
        </div>
      </details>
    </div>
  );
}
