import type { ShippingRate } from '@/lib/supabase-types';
import type { ShippingTypeId } from './shipping-types';

export interface CalculationInput {
  productName: string;
  unitCostUSD: number;
  quantity: number;
  weightPerUnitKg: number;
  volumePerUnitCBM: number | null;
  shippingType: ShippingTypeId;
  exchangeRate: number;
  sellingPriceLocal?: number;
  markupPercent?: number;
  // Optional manual shipping rate override (USD per kg or per CBM depending on type)
  manualShippingRate?: number | null;
}

export interface CalculationResult {
  // Product costs
  totalProductCostUSD: number;

  // Shipping
  totalWeightKg: number;
  totalVolumeCBM: number;
  shippingCostUSD: number;
  shippingRateUsed: number;
  shippingTier: string;

  // Totals
  totalCostUSD: number;
  totalCostLocal: number;

  // Per unit
  costPerUnitLocal: number;

  // Profit (requires selling price)
  sellingPricePerUnit?: number;
  totalSellingPrice?: number;
  profitPerUnit?: number;
  totalProfit?: number;
  marginPercent?: number;

  // Classification
  profitIndicator: 'low' | 'medium' | 'high';
}

// Manual rate helpers based on TODAY CARGO pricing
function getManualTierLabel(shippingType: ShippingTypeId, totalWeightKg: number): string {
  switch (shippingType) {
    case 'air_general_7days':
    case 'air_sensitive_14days':
      return totalWeightKg >= 10 ? '10kg+ (manual)' : '1kg+ (manual)';
    case 'sea_small_parcel':
      return 'per kg (manual)';
    case 'sea_cbm':
      return 'per CBM (manual)';
    case 'sea_heavy':
      return 'per ton (manual)';
    default:
      return 'manual';
  }
}

function applyManualRate(totalWeightKg: number, totalVolumeCBM: number, shippingType: ShippingTypeId, rate: number): number {
  switch (shippingType) {
    case 'air_general_7days':
    case 'air_sensitive_14days':
    case 'sea_small_parcel':
      return totalWeightKg * rate;
    case 'sea_heavy':
      // Rate is per ton, convert kg to tons
      return (totalWeightKg / 1000) * rate;
    case 'sea_cbm':
      return totalVolumeCBM * rate;
    default:
      return totalWeightKg * rate;
  }
}

export function calculateShippingCost(
  totalWeightKg: number,
  totalVolumeCBM: number,
  shippingType: ShippingTypeId,
  rates: ShippingRate[],
  manualRateOverride?: number | null
): { cost: number; rateUsed: number; tier: string } {
  // Manual override takes precedence over database rates
  if (manualRateOverride !== undefined && manualRateOverride !== null && manualRateOverride > 0) {
    const tier = getManualTierLabel(shippingType, totalWeightKg);
    return {
      cost: applyManualRate(totalWeightKg, totalVolumeCBM, shippingType, manualRateOverride),
      rateUsed: manualRateOverride,
      tier,
    };
  }

  if (!rates || rates.length === 0) {
    return { cost: 0, rateUsed: 0, tier: 'rates_required' };
  }

  switch (shippingType) {
    case 'air_general_7days':
    case 'air_sensitive_14days': {
      // Tiered by total weight
      const tier10plus = rates.find(
        r => r.shipping_type === shippingType && r.tier_max_kg === null
      );
      const tier1plus = rates.find(
        r => r.shipping_type === shippingType && r.tier_max_kg !== null && r.tier_max_kg < 10
      );

      const is10kgPlus = totalWeightKg >= 10;
      const rate = is10kgPlus ? tier10plus?.rate : tier1plus?.rate;

      if (!rate) return { cost: 0, rateUsed: 0, tier: 'rate_not_set' };

      const tier = is10kgPlus ? '10kg+' : '1kg+';
      return {
        cost: totalWeightKg * rate,
        rateUsed: rate,
        tier,
      };
    }

    case 'sea_small_parcel': {
      const rate = rates.find(r => r.shipping_type === 'sea_small_parcel');
      if (!rate) return { cost: 0, rateUsed: 0, tier: 'rate_not_set' };
      return {
        cost: totalWeightKg * rate.rate,
        rateUsed: rate.rate,
        tier: 'per kg',
      };
    }

    case 'sea_cbm': {
      if (totalVolumeCBM < 0.1) {
        const rate = rates.find(r => r.shipping_type === 'sea_small_parcel');
        if (!rate) return { cost: 0, rateUsed: 0, tier: 'rate_not_set' };
        return {
          cost: totalWeightKg * rate.rate,
          rateUsed: rate.rate,
          tier: '<0.1 CBM fallback',
        };
      }

      const rate = rates.find(
        r => r.shipping_type === 'sea_cbm' &&
          r.volume_min_cbm !== null &&
          r.volume_max_cbm !== null &&
          totalVolumeCBM >= r.volume_min_cbm &&
          totalVolumeCBM <= r.volume_max_cbm
      ) || rates.find(r => r.shipping_type === 'sea_cbm' && r.volume_min_cbm !== null && r.volume_max_cbm === null);

      if (!rate) return { cost: 0, rateUsed: 0, tier: 'rate_not_set' };

      return {
        cost: totalVolumeCBM * rate.rate,
        rateUsed: rate.rate,
        tier: `${rate.volume_min_cbm}-${rate.volume_max_cbm || '+'} CBM`,
      };
    }

    case 'sea_heavy': {
      const rate = rates.find(r => r.shipping_type === 'sea_heavy');
      if (!rate) return { cost: 0, rateUsed: 0, tier: 'rate_not_set' };
      // Rate is per ton, convert kg to tons
      return {
        cost: (totalWeightKg / 1000) * rate.rate,
        rateUsed: rate.rate,
        tier: 'per ton',
      };
    }

    default:
      return { cost: 0, rateUsed: 0, tier: 'unknown_type' };
  }
}

export function calculateLandedCost(
  input: CalculationInput,
  rates: ShippingRate[]
): CalculationResult {
  const totalProductCostUSD = input.unitCostUSD * input.quantity;
  const totalWeightKg = input.weightPerUnitKg * input.quantity;
  const totalVolumeCBM = (input.volumePerUnitCBM || 0) * input.quantity;

  const shipping = calculateShippingCost(totalWeightKg, totalVolumeCBM, input.shippingType, rates, input.manualShippingRate);
  const shippingCostUSD = shipping.cost;
  const totalCostUSD = totalProductCostUSD + shippingCostUSD;
  const totalCostLocal = totalCostUSD * input.exchangeRate;
  const costPerUnitLocal = totalCostLocal / input.quantity;

  const result: CalculationResult = {
    totalProductCostUSD,
    totalWeightKg,
    totalVolumeCBM,
    shippingCostUSD,
    shippingRateUsed: shipping.rateUsed,
    shippingTier: shipping.tier,
    totalCostUSD,
    totalCostLocal,
    costPerUnitLocal,
    profitIndicator: 'low',
  };

  // Calculate profit if selling price or markup is provided
  if (input.sellingPriceLocal !== undefined && input.sellingPriceLocal > 0) {
    result.sellingPricePerUnit = input.sellingPriceLocal;
    result.totalSellingPrice = input.sellingPriceLocal * input.quantity;
    result.profitPerUnit = input.sellingPriceLocal - costPerUnitLocal;
    result.totalProfit = result.profitPerUnit * input.quantity;
    result.marginPercent = (result.profitPerUnit / input.sellingPriceLocal) * 100;
  } else if (input.markupPercent !== undefined && input.markupPercent > 0) {
    result.sellingPricePerUnit = costPerUnitLocal * (1 + input.markupPercent / 100);
    result.totalSellingPrice = result.sellingPricePerUnit * input.quantity;
    result.profitPerUnit = result.sellingPricePerUnit - costPerUnitLocal;
    result.totalProfit = result.profitPerUnit * input.quantity;
    result.marginPercent = input.markupPercent;
  }

  // Profit indicator classification
  if (result.marginPercent !== undefined) {
    if (result.marginPercent < 20) {
      result.profitIndicator = 'low';
    } else if (result.marginPercent < 40) {
      result.profitIndicator = 'medium';
    } else {
      result.profitIndicator = 'high';
    }
  }

  return result;
}

// NOTE: Rates are fetched from database via getShippingRates()
// If database rates are unavailable, return null to indicate calculation cannot proceed