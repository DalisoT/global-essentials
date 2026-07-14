'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import { calculateShippingCost } from '@/lib/import/calculator';
import { SHIPPING_TYPES, type ShippingTypeId } from '@/lib/import/shipping-types';
import type { ShippingRate } from '@/lib/supabase-types';
import type {
  ShippingRecommendation,
  ProfitabilityAdvice,
  BreakEvenResult,
  DemandAdjustment,
  ImportAdvisorOutput,
  CashFlowImpact,
  DailyCashFlow,
} from '@/lib/import/advisor-types';
import { calculateBreakEvenQuantity } from '@/lib/import/import-advisor-calc';
import groq from '@/lib/groq';
import {
  shippingRecommender,
  profitabilityAdvisor,
  demandAdjustment,
} from '@/lib/ai/prompts';

// ─────────────────────────────────────────────
// FEATURE 1: SHIPPING METHOD RECOMMENDER
// ─────────────────────────────────────────────
export async function getShippingRecommendation(
  input: {
    unitCostUSD: number;
    quantity: number;
    weightPerUnitKg: number;
    volumePerUnitCBM: number | null;
    exchangeRate: number;
    sellingPriceLocal?: number;
  },
  rates: ShippingRate[]
): Promise<{ data?: ShippingRecommendation; error?: string }> {
  const totalWeight = input.weightPerUnitKg * input.quantity;
  const totalVolume = (input.volumePerUnitCBM || 0) * input.quantity;

  const methodCosts = SHIPPING_TYPES.map((st) => {
    const { cost } = calculateShippingCost(totalWeight, totalVolume, st.id, rates);
    const costPerUnitUSD = cost / input.quantity;
    const costPerUnitLocal = costPerUnitUSD * input.exchangeRate;
    return {
      methodId: st.id,
      methodName: st.name,
      transitDays: st.transitDays,
      shippingCost: cost,
      costPerUnitLocal,
    };
  });

  const maxCost = Math.max(...methodCosts.map((m) => m.shippingCost));

  const scores = methodCosts.map((m) => {
    const costEfficiency = maxCost > 0 ? 100 - (m.shippingCost / maxCost) * 100 : 100;
    const cashFlowTiming = m.transitDays <= 14 ? 100 : m.transitDays <= 30 ? 80 : m.transitDays <= 50 ? 40 : 20;
    const marginImpact = input.sellingPriceLocal
      ? Math.abs(methodCosts[0].costPerUnitLocal - m.costPerUnitLocal) / input.sellingPriceLocal * 100
      : 50;
    const marginSensitivity = marginImpact < 2 ? 100 : marginImpact < 5 ? 80 : marginImpact < 10 ? 50 : 20;
    const leadTimeUrgency = Math.max(0, 100 - m.transitDays * 2);
    const overallScore = costEfficiency * 0.35 + cashFlowTiming * 0.25 + marginSensitivity * 0.20 + leadTimeUrgency * 0.20;

    return {
      methodId: m.methodId,
      methodName: m.methodName,
      transitDays: m.transitDays,
      costEfficiency: Math.round(costEfficiency),
      cashFlowTiming: Math.round(cashFlowTiming),
      marginSensitivity: Math.round(marginSensitivity),
      leadTimeUrgency: Math.round(leadTimeUrgency),
      overallScore: Math.round(overallScore),
    };
  });

  const byOverall = [...scores].sort((a, b) => b.overallScore - a.overallScore);
  const byTransit = [...scores].sort((a, b) => a.transitDays - b.transitDays);
  const byMargin = [...scores].sort((a, b) => b.marginSensitivity - a.marginSensitivity);

  const messages = [
    {
      role: 'system' as const,
      content: shippingRecommender.system,
    },
    {
      role: 'user' as const,
      content: shippingRecommender.buildUserMessage({
        productName: '(not provided)',  // shipping rec doesn't take a product name today
        unitCostUSD: input.unitCostUSD,
        quantity: input.quantity,
        sellingPriceLocal: input.sellingPriceLocal,
        scores: scores.map((s) => ({
          methodName: s.methodName,
          transitDays: s.transitDays,
          cost_efficiency: s.costEfficiency,
          cash_flow: s.cashFlowTiming,
          margin: s.marginSensitivity,
          lead: s.leadTimeUrgency,
          overall: s.overallScore,
        })),
        bestOverall: byOverall[0].methodName,
        fastest: byTransit[0].methodName,
        marginSafest: byMargin[0].methodName,
      }),
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: shippingRecommender.meta.model,
    temperature: shippingRecommender.meta.temperature,
    max_tokens: shippingRecommender.meta.maxTokens,
  });

  const content = response.choices[0]?.message?.content?.trim() || '';
  let aiSummary = content;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiSummary = JSON.parse(jsonMatch[0]).summary || content;
  } catch {}

  return {
    data: {
      rankings: {
        bestValue: byOverall[0],
        fastest: byTransit[0],
        marginSafest: byMargin[0],
      },
      aiSummary,
    },
  };
}

// ─────────────────────────────────────────────
// FEATURE 2: PROFITABILITY ADVISOR
// ─────────────────────────────────────────────
export async function getProfitabilityAdvice(
  productName: string,
  unitCostUSD: number,
  quantity: number,
  weightPerUnitKg: number,
  volumePerUnitCBM: number | null,
  exchangeRate: number,
  targetMarginPercent: number,
  rates: ShippingRate[]
): Promise<{ data?: ProfitabilityAdvice; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const totalWeight = weightPerUnitKg * quantity;
  const totalVolume = (volumePerUnitCBM || 0) * quantity;
  const { cost: shippingCost } = calculateShippingCost(totalWeight, totalVolume, 'air_general_7days', rates);
  const totalCostUSD = unitCostUSD * quantity + shippingCost;
  const costPerUnitLocal = (totalCostUSD / quantity) * exchangeRate;
  const requiredSellingPrice = costPerUnitLocal * (1 + targetMarginPercent / 100);

  const { data: similarProducts } = await supabase
    .from('products')
    .select('selling_price')
    .ilike('name', `%${productName}%`)
    .limit(10);

  const marketAvg = similarProducts && similarProducts.length > 0
    ? similarProducts.reduce((sum, p) => sum + p.selling_price, 0) / similarProducts.length
    : null;

  const isBelowMarketAverage = marketAvg !== null && requiredSellingPrice < marketAvg;

  const messages = [
    {
      role: 'system' as const,
      content: profitabilityAdvisor.system,
    },
    {
      role: 'user' as const,
      content: profitabilityAdvisor.buildUserMessage({
        productName,
        unitCostUSD,
        targetMarginPercent,
        requiredSellingPrice,
        marketAverage: marketAvg,
        isBelowMarketAverage,
      }),
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: profitabilityAdvisor.meta.model,
    temperature: profitabilityAdvisor.meta.temperature,
    max_tokens: profitabilityAdvisor.meta.maxTokens,
  });

  let aiMarketIntelligence = '';
  try {
    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) aiMarketIntelligence = JSON.parse(jsonMatch[0]).insight || '';
  } catch {}

  return {
    data: {
      suggestedSellingPrice: Math.round(requiredSellingPrice * 100) / 100,
      targetMarginPercent,
      costPerUnitLocal: Math.round(costPerUnitLocal * 100) / 100,
      marketAveragePrice: marketAvg,
      isBelowMarketAverage,
      marketAlert: isBelowMarketAverage
        ? `Target price (K${requiredSellingPrice.toFixed(2)}) is below market (K${marketAvg!.toFixed(2)}). Consider ${targetMarginPercent + 5}% markup.`
        : null,
      aiMarketIntelligence,
    },
  };
}

// ─────────────────────────────────────────────
// FEATURE 3: CASH FLOW IMPACT
// ─────────────────────────────────────────────
export async function calculateCashFlowImpact(
  quantity: number,
  sellingPricePerUnit: number,
  shippingType: ShippingTypeId,
  rates: ShippingRate[]
): Promise<{ data?: CashFlowImpact; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const FORECAST_DAYS = 30;
  const AIR_ARRIVAL = 7;
  const SEA_ARRIVAL = 50;

  const { cost: airShipping } = calculateShippingCost(quantity, 0, 'air_general_7days', rates);
  const { cost: seaShipping } = calculateShippingCost(quantity, 0, 'sea_cbm', rates);
  const airPremium = airShipping - seaShipping;

  const totalRevenue = quantity * sellingPricePerUnit;
  const dailySellRate = totalRevenue / 30;

  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + FORECAST_DAYS);

  const { data: installments } = await supabase
    .from('installments')
    .select('amount_due, due_date, is_paid')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', endDate.toISOString().split('T')[0])
    .eq('is_paid', false);

  const dailyConfirmed: number[] = Array(FORECAST_DAYS).fill(0);
  for (let i = 0; i < FORECAST_DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    dailyConfirmed[i] = (installments || [])
      .filter((inst) => inst.due_date === dateStr)
      .reduce((sum, inst) => sum + inst.amount_due, 0);
  }

  const dailyImpact: DailyCashFlow[] = [];
  let cumulativeAir = 0;
  let cumulativeSea = 0;
  let breakevenDay: number | null = null;

  for (let day = 1; day <= FORECAST_DAYS; day++) {
    const idx = day - 1;
    const airCashFlow = day >= AIR_ARRIVAL ? dailySellRate : 0;
    const seaCashFlow = day >= SEA_ARRIVAL ? dailySellRate : 0;

    cumulativeAir += airCashFlow + dailyConfirmed[idx];
    cumulativeSea += seaCashFlow + dailyConfirmed[idx];

    if (breakevenDay === null && cumulativeAir - cumulativeSea >= airPremium) {
      breakevenDay = day;
    }

    dailyImpact.push({
      day,
      airCashFlow: Math.round((airCashFlow + dailyConfirmed[idx]) * 100) / 100,
      seaCashFlow: Math.round((seaCashFlow + dailyConfirmed[idx]) * 100) / 100,
      cumulativeAir: Math.round(cumulativeAir * 100) / 100,
      cumulativeSea: Math.round(cumulativeSea * 100) / 100,
    });
  }

  return {
    data: {
      shippingType,
      revenueDelayDays: SEA_ARRIVAL - AIR_ARRIVAL,
      dailyImpact,
      totalAirCashFlow: Math.round(cumulativeAir * 100) / 100,
      totalSeaCashFlow: Math.round(cumulativeSea * 100) / 100,
      breakevenDay,
      airPremiumCost: Math.round(airPremium * 100) / 100,
    },
  };
}

// ─────────────────────────────────────────────
// FEATURE 5: DEMAND/SALES VELOCITY ADJUSTMENT
// ─────────────────────────────────────────────
export async function getDemandAdjustment(
  productName: string,
  unitCostUSD: number,
  sellingPriceLocal: number,
  rates: ShippingRate[]
): Promise<{ data?: DemandAdjustment; error?: string }> {
  const { getSalesVelocity } = await import('@/lib/actions/reorder');

  const { data: velocities } = await getSalesVelocity(90);
  const matched = velocities?.find(
    (v) => v.product_name.toLowerCase().includes(productName.toLowerCase())
  );

  if (!matched) {
    return {
      data: {
        productId: null,
        avgDailyVelocity: 0,
        daysUntilStockout: -1,
        urgency: 'low',
        stockoutCost: 0,
        shippingPremium: 0,
        shouldUseAir: false,
        recommendation: 'No sales history found. Sea shipping recommended for cost efficiency.',
      },
    };
  }

  const testQty = 100;
  const { cost: airCost } = calculateShippingCost(testQty, 0, 'air_general_7days', rates);
  const { cost: seaCost } = calculateShippingCost(testQty, 0, 'sea_cbm', rates);
  const premium = (airCost - seaCost) / testQty;

  const stockoutCost = matched.avg_daily_velocity > 0
    ? matched.days_until_stockout * sellingPriceLocal
    : 0;
  const shouldUseAir = matched.urgency === 'high' || stockoutCost > premium * matched.days_until_stockout;

  const messages = [
    {
      role: 'system' as const,
      content: demandAdjustment.system,
    },
    {
      role: 'user' as const,
      content: demandAdjustment.buildUserMessage({
        productName,
        avgDailyVelocity: matched.avg_daily_velocity,
        daysUntilStockout: matched.days_until_stockout,
        urgency: matched.urgency,
        stockoutCost,
        shippingPremiumPerUnit: premium,
        shouldUseAir,
      }),
    },
  ];

  const response = await groq.chat.completions.create({
    messages: messages as any,
    model: demandAdjustment.meta.model,
    temperature: demandAdjustment.meta.temperature,
    max_tokens: demandAdjustment.meta.maxTokens,
  });

  let recommendation = '';
  try {
    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) recommendation = JSON.parse(jsonMatch[0]).recommendation || '';
  } catch {}

  if (!recommendation) {
    recommendation = shouldUseAir
      ? `High urgency (${matched.urgency}) — recommend air to avoid stockout in ${matched.days_until_stockout} days.`
      : `Standard urgency — sea shipping is cost-efficient.`;
  }

  return {
    data: {
      productId: matched.product_id,
      avgDailyVelocity: matched.avg_daily_velocity,
      daysUntilStockout: matched.days_until_stockout,
      urgency: matched.urgency,
      stockoutCost: Math.round(stockoutCost * 100) / 100,
      shippingPremium: Math.round(premium * 100) / 100,
      shouldUseAir,
      recommendation,
    },
  };
}

// ─────────────────────────────────────────────
// COMBINED ADVISOR ACTION
// ─────────────────────────────────────────────
export async function getImportAdvisor(
  input: {
    productName: string;
    unitCostUSD: number;
    quantity: number;
    weightPerUnitKg: number;
    volumePerUnitCBM: number | null;
    exchangeRate: number;
    sellingPriceLocal?: number;
    markupPercent?: number;
  },
  rates: ShippingRate[]
): Promise<{ data?: ImportAdvisorOutput; error?: string }> {
  const productCostLocal = input.unitCostUSD * input.exchangeRate;
  const sellingPrice = input.sellingPriceLocal ||
    (input.markupPercent ? productCostLocal * (1 + input.markupPercent / 100) : 0);

  const [shippingRec, profitability, demandAdj] = await Promise.all([
    input.sellingPriceLocal || input.markupPercent
      ? getShippingRecommendation(input, rates)
      : Promise.resolve({ data: null }),
    input.sellingPriceLocal || input.markupPercent
      ? getProfitabilityAdvice(input.productName, input.unitCostUSD, input.quantity, input.weightPerUnitKg, input.volumePerUnitCBM, input.exchangeRate, input.markupPercent || 30, rates)
      : Promise.resolve({ data: null }),
    getDemandAdjustment(input.productName, input.unitCostUSD, sellingPrice, rates),
  ]);

  const breakEven = sellingPrice > 0
    ? calculateBreakEvenQuantity(input.unitCostUSD, input.weightPerUnitKg, input.volumePerUnitCBM, input.exchangeRate, sellingPrice, rates)
    : null;

  const cashFlowResult = sellingPrice > 0
    ? await calculateCashFlowImpact(input.quantity, sellingPrice, 'air_general_7days', rates)
    : { data: null };

  return {
    data: {
      shippingRecommendation: shippingRec.data || null,
      profitabilityAdvice: profitability.data || null,
      cashFlowImpact: cashFlowResult.data || null,
      breakEven,
      demandAdjustment: demandAdj.data || null,
    },
  };
}
