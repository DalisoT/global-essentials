import type { ShippingTypeId } from '@/lib/import/shipping-types';

// ─────────────────────────────────────────────
// SHIPPING METHOD RECOMMENDER (Feature 1)
// ─────────────────────────────────────────────
export interface ShippingScore {
  methodId: ShippingTypeId;
  methodName: string;
  transitDays: number;
  costEfficiency: number;      // 0-100
  cashFlowTiming: number;       // 0-100
  marginSensitivity: number;    // 0-100
  leadTimeUrgency: number;     // 0-100
  overallScore: number;        // 0-100 weighted
}

export interface ShippingRecommendation {
  rankings: {
    bestValue: ShippingScore;
    fastest: ShippingScore;
    marginSafest: ShippingScore;
  };
  aiSummary: string;
}

// ─────────────────────────────────────────────
// PROFITABILITY ADVISOR (Feature 2)
// ─────────────────────────────────────────────
export interface ProfitabilityAdvice {
  suggestedSellingPrice: number;
  targetMarginPercent: number;
  costPerUnitLocal: number;
  marketAveragePrice: number | null;
  isBelowMarketAverage: boolean;
  marketAlert: string | null;
  aiMarketIntelligence: string;
}

// ─────────────────────────────────────────────
// CASH FLOW IMPACT SIMULATOR (Feature 3)
// ─────────────────────────────────────────────
export interface DailyCashFlow {
  day: number;
  airCashFlow: number;
  seaCashFlow: number;
  cumulativeAir: number;
  cumulativeSea: number;
}

export interface CashFlowImpact {
  shippingType: ShippingTypeId;
  revenueDelayDays: number;
  dailyImpact: DailyCashFlow[];
  totalAirCashFlow: number;
  totalSeaCashFlow: number;
  breakevenDay: number | null;
  airPremiumCost: number;
}

// ─────────────────────────────────────────────
// BREAK-EVEN QUANTITY RECOMMENDER (Feature 4)
// ─────────────────────────────────────────────
export interface BreakEvenResult {
  minQuantityForAirWorthwhile: number;
  airPremiumPerUnit: number;
  seaCostPerUnit: number;
  airCostPerUnit: number;
  isAirWorthwhileAtQuantity: boolean;
  currentQuantityRecommendation: string;
  formulaExplanation: string;
}

// ─────────────────────────────────────────────
// DEMAND/SALES VELOCITY ADJUSTMENT (Feature 5)
// ─────────────────────────────────────────────
export interface DemandAdjustment {
  productId: string | null;
  avgDailyVelocity: number;
  daysUntilStockout: number;
  urgency: 'low' | 'medium' | 'high';
  stockoutCost: number;
  shippingPremium: number;
  shouldUseAir: boolean;
  recommendation: string;
}

// ─────────────────────────────────────────────
// COMBINED ADVISOR OUTPUT
// ─────────────────────────────────────────────
export interface ImportAdvisorOutput {
  shippingRecommendation: ShippingRecommendation | null;
  profitabilityAdvice: ProfitabilityAdvice | null;
  cashFlowImpact: CashFlowImpact | null;
  breakEven: BreakEvenResult | null;
  demandAdjustment: DemandAdjustment | null;
}
