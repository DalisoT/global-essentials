/**
 * Shipping method recommender prompt.
 *
 * Used by `lib/actions/import-advisor.ts → getShippingRecommendation`. The
 * caller pre-computes cost-efficiency / cash-flow / margin / lead-time
 * scores for each method and the model just synthesizes a 2-3 sentence
 * recommendation.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'shipping-recommender' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  maxTokens: 256,
} as const;

export const system = `You are a shipping logistics advisor. Return a JSON object with:
- summary: 2-3 sentence natural language recommendation for the best shipping method(s) with reasoning. No emojis.`;

export interface ShippingMethodScore {
  methodName: string;
  transitDays: number;
  cost_efficiency: number;
  cash_flow: number;
  margin: number;
  lead: number;
  overall: number;
}

export interface ShippingRecInput {
  productName: string;
  unitCostUSD: number;
  quantity: number;
  sellingPriceLocal?: number;
  scores: ShippingMethodScore[];
  bestOverall: string;
  fastest: string;
  marginSafest: string;
}

export function buildUserMessage(input: ShippingRecInput): string {
  return `Shipping methods for product: unit cost $${input.unitCostUSD}, qty ${input.quantity}, selling price ${input.sellingPriceLocal ? 'K' + input.sellingPriceLocal : 'not set'}

${input.scores.map((s) => `${s.methodName}: overall=${s.overall}, cost_eff=${s.cost_efficiency}, cash_flow=${s.cash_flow}, margin=${s.margin}, lead=${s.lead}`).join('\n')}

Best overall: ${input.bestOverall}
Fastest: ${input.fastest}
Margin safest: ${input.marginSafest}`;
}
