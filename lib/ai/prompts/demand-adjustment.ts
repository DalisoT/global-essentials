/**
 * Demand / sales-velocity adjustment prompt.
 *
 * Used by `lib/actions/import-advisor.ts → getDemandAdjustment`. The caller
 * already computed velocity, days-until-stockout, shipping premium, and a
 * rule-based `shouldUseAir` decision; the model produces the final 1-sentence
 * recommendation in plain English.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'demand-adjustment' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.3,
  maxTokens: 128,
} as const;

export const system = `You are a supply chain advisor. Return a JSON object with:
- recommendation: 1 sentence recommendation`;

export interface DemandAdjustmentInput {
  productName: string;
  avgDailyVelocity: number;
  daysUntilStockout: number;
  urgency: string;
  stockoutCost: number;
  shippingPremiumPerUnit: number;
  shouldUseAir: boolean;
}

export function buildUserMessage(input: DemandAdjustmentInput): string {
  return `Product: ${input.productName}
Velocity: ${input.avgDailyVelocity.toFixed(2)} units/day
Days until stockout: ${input.daysUntilStockout}
Urgency: ${input.urgency}
Stockout cost: K${input.stockoutCost.toFixed(2)}
Air vs Sea premium: K${input.shippingPremiumPerUnit.toFixed(2)}/unit
Should use air: ${input.shouldUseAir ? 'YES' : 'NO'}`;
}
