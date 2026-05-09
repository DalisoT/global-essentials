'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { DemandAdjustment } from '@/lib/import/advisor-types';
import type { ShippingTypeId } from '@/lib/import/shipping-types';
import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface DemandIndicatorProps {
  adjustment: DemandAdjustment;
  onSelectShipping: (methodId: ShippingTypeId) => void;
}

export function DemandIndicator({ adjustment, onSelectShipping }: DemandIndicatorProps) {
  const {
    avgDailyVelocity,
    daysUntilStockout,
    urgency,
    stockoutCost,
    shippingPremium,
    shouldUseAir,
    recommendation,
  } = adjustment;

  if (urgency === 'low' && daysUntilStockout === -1) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
          Demand Indicator
        </h3>
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
          <p className="text-xs text-white/50">No sales history for this product</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Demand Indicator
      </h3>

      {/* Urgency Badge */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'px-3 py-1 rounded-full text-xs font-bold uppercase',
          urgency === 'high' && 'bg-tactical-red/20 text-tactical-red border border-tactical-red/30',
          urgency === 'medium' && 'bg-tactical-orange/20 text-tactical-orange border border-tactical-orange/30',
          urgency === 'low' && 'bg-tactical-neon/20 text-tactical-neon border border-tactical-neon/30'
        )}>
          {urgency} urgency
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/50 mb-1">Daily Velocity</div>
          <div className="text-lg font-bold text-tactical-neon">
            {avgDailyVelocity.toFixed(2)} <span className="text-xs text-white/50">units/day</span>
          </div>
        </div>
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-xs text-white/50 mb-1">Stockout In</div>
          <div className="text-lg font-bold text-tactical-orange">
            {daysUntilStockout} <span className="text-xs text-white/50">days</span>
          </div>
        </div>
      </div>

      {/* Cost Comparison */}
      <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/50">Stockout Cost</span>
          <span className="font-bold text-tactical-red">{formatCurrency(stockoutCost)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/50">Air Premium</span>
          <span className="font-bold text-tactical-orange">+{formatCurrency(shippingPremium)}/unit</span>
        </div>
      </div>

      {/* Recommendation */}
      <div className={cn(
        'p-3 rounded-xl border flex items-start gap-2',
        shouldUseAir
          ? 'bg-tactical-red/10 border-tactical-red/30 text-tactical-red'
          : 'bg-white/5 border-white/10 text-white/70'
      )}>
        {shouldUseAir ? (
          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
        ) : (
          <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="text-xs font-bold uppercase mb-1">
            {shouldUseAir ? 'Recommend Air Shipping' : 'Sea Shipping OK'}
          </div>
          <p className="text-xs">{recommendation}</p>
        </div>
      </div>

      {/* Quick Action */}
      {shouldUseAir && (
        <button
          onClick={() => onSelectShipping('air_general_7days')}
          className="w-full py-2 bg-tactical-red/20 border border-tactical-red/30 rounded-xl text-tactical-red text-sm font-bold hover:bg-tactical-red/30 transition-colors"
        >
          Switch to Air 7D
        </button>
      )}
    </div>
  );
}
