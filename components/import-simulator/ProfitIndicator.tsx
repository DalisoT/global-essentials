'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { CalculationResult } from '@/lib/import/calculator';

interface ProfitIndicatorProps {
  result: CalculationResult;
}

export function ProfitIndicator({ result }: ProfitIndicatorProps) {
  if (!result.profitPerUnit) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Profit Analysis
      </h3>

      {/* Selling Price */}
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-sm">Selling Price/Unit</span>
        <span className="font-bold text-tactical-neon">
          {formatCurrency(result.sellingPricePerUnit!)}
        </span>
      </div>

      {/* Total Revenue */}
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-sm">Total Revenue</span>
        <span className="font-semibold">
          {formatCurrency(result.totalSellingPrice!)}
        </span>
      </div>

      {/* Profit Per Unit */}
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-sm">Profit/Unit</span>
        <span className={cn(
          'font-bold',
          result.profitPerUnit > 0 ? 'text-tactical-neon' : 'text-tactical-red'
        )}>
          {formatCurrency(result.profitPerUnit)}
        </span>
      </div>

      {/* Total Profit */}
      <div className="flex justify-between items-center bg-white/5 rounded-xl p-3">
        <span className="text-white/80 text-sm font-medium">Total Profit</span>
        <span className={cn(
          'font-bold text-xl',
          result.totalProfit! > 0 ? 'text-tactical-neon' : 'text-tactical-red'
        )}>
          {formatCurrency(result.totalProfit!)}
        </span>
      </div>

      {/* Margin */}
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-sm">Margin</span>
        <span className={cn(
          'font-bold px-3 py-1 rounded-lg',
          result.profitIndicator === 'high' && 'bg-tactical-neon/20 text-tactical-neon',
          result.profitIndicator === 'medium' && 'bg-tactical-orange/20 text-tactical-orange',
          result.profitIndicator === 'low' && 'bg-tactical-red/20 text-tactical-red'
        )}>
          {result.marginPercent?.toFixed(1)}%
        </span>
      </div>

      {/* Profit Indicator Badge */}
      <div className={cn(
        'flex justify-center items-center p-3 rounded-xl font-bold uppercase tracking-wide',
        result.profitIndicator === 'high' && 'bg-tactical-neon/20 text-tactical-neon border border-tactical-neon/30',
        result.profitIndicator === 'medium' && 'bg-tactical-orange/20 text-tactical-orange border border-tactical-orange/30',
        result.profitIndicator === 'low' && 'bg-tactical-red/20 text-tactical-red border border-tactical-red/30'
      )}>
        {result.profitIndicator === 'high' ? 'Excellent Margin' :
         result.profitIndicator === 'medium' ? 'Good Margin' :
         'Low Margin - Consider Adjusting'}
      </div>
    </div>
  );
}