'use client';

import { formatCurrency } from '@/lib/utils';
import type { CalculationResult } from '@/lib/import/calculator';
import { cn } from '@/lib/utils';

interface CostBreakdownProps {
  result: CalculationResult;
}

export function CostBreakdown({ result }: CostBreakdownProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Cost Breakdown
      </h3>

      <div className="space-y-2">
        {/* Product Cost */}
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-sm">Product Cost (USD)</span>
          <span className="font-semibold">
            ${result.totalProductCostUSD.toFixed(2)}
          </span>
        </div>

        {/* Shipping Cost */}
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-sm">
            Shipping ({result.totalWeightKg.toFixed(2)}kg, {result.shippingTier})
          </span>
          <span className="font-semibold">
            ${result.shippingCostUSD.toFixed(2)}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Total Cost (USD)</span>
            <span className="font-bold text-tactical-orange">
              ${result.totalCostUSD.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Total in Local Currency */}
        <div className="flex justify-between items-center bg-white/5 rounded-xl p-3">
          <span className="text-white/80 text-sm font-medium">Total Cost (ZMW)</span>
          <span className="font-bold text-xl text-tactical-neon">
            {formatCurrency(result.totalCostLocal)}
          </span>
        </div>

        {/* Cost Per Unit */}
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-sm">Cost Per Unit</span>
          <span className="font-semibold">
            {formatCurrency(result.costPerUnitLocal)}
          </span>
        </div>

        {/* Shipping Details */}
        <div className="text-xs text-white/40 text-right">
          Rate: ${result.shippingRateUsed.toFixed(2)} {result.shippingTier}
        </div>
      </div>
    </div>
  );
}