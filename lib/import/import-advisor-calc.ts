import { calculateShippingCost } from '@/lib/import/calculator';
import { SHIPPING_TYPES } from '@/lib/import/shipping-types';
import type { ShippingRate } from '@/lib/supabase-types';
import type { BreakEvenResult } from './advisor-types';

// Pure calculation — no server action, no 'use server'
export function calculateBreakEvenQuantity(
  unitCostUSD: number,
  weightPerUnitKg: number,
  volumePerUnitCBM: number | null,
  exchangeRate: number,
  sellingPriceLocal: number,
  rates: ShippingRate[]
): BreakEvenResult {
  const Q = 100; // reference batch size
  const totalWeight = weightPerUnitKg * Q;
  const totalVolume = (volumePerUnitCBM || 0) * Q;

  const { cost: airCost } = calculateShippingCost(totalWeight, totalVolume, 'air_general_7days', rates);
  const { cost: seaCost } = calculateShippingCost(totalWeight, totalVolume, 'sea_cbm', rates);

  const airCostPerUnit = airCost / Q;
  const seaCostPerUnit = seaCost / Q;
  const airPremiumPerUnit = airCostPerUnit - seaCostPerUnit;

  // Sea delay: 43 days difference (50 sea - 7 air)
  const seaDelayDays = 43;
  const dailyRevenueValue = sellingPriceLocal / 30;
  const valueOfFasterCashFlow = dailyRevenueValue * seaDelayDays;

  // Break-even when extra air cost equals value of 30-day earlier cash flow
  const breakEvenQty = airPremiumPerUnit > 0
    ? Math.ceil((airPremiumPerUnit / Q * Q) / dailyRevenueValue * seaDelayDays || 0)
    : 0;

  const isWorthwhile = breakEvenQty > 0 && Q >= breakEvenQty;

  return {
    minQuantityForAirWorthwhile: breakEvenQty,
    airPremiumPerUnit: Math.round(airPremiumPerUnit * 100) / 100,
    seaCostPerUnit: Math.round(seaCostPerUnit * 100) / 100,
    airCostPerUnit: Math.round(airCostPerUnit * 100) / 100,
    isAirWorthwhileAtQuantity: isWorthwhile,
    currentQuantityRecommendation: Q >= breakEvenQty
      ? `Air shipping worthwhile at ${Q} units.`
      : `Sea recommended for ${Q} units — air premium (K${airPremiumPerUnit.toFixed(2)}/unit) exceeds value of earlier cash flow (K${valueOfFasterCashFlow.toFixed(2)}).`,
    formulaExplanation: `Q_be = daily revenue (K${dailyRevenueValue.toFixed(2)}) × sea delay (${seaDelayDays}d) / air premium (K${airPremiumPerUnit.toFixed(2)}) = ${breakEvenQty} units`,
  };
}
