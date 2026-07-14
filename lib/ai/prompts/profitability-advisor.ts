/**
 * Profitability / pricing advisor prompt.
 *
 * Used by `lib/actions/import-advisor.ts → getProfitabilityAdvice`. Caller
 * already computes the required selling price + market average, the model
 * produces a short "insight" + an "alert" string when below market.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'profitability-advisor' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  maxTokens: 200,
} as const;

export const system = `You are a market intelligence analyst. Return a JSON object with:
- insight: 1-2 sentence insight about pricing competitiveness
- alert: warning message if price is below market average, otherwise null`;

export interface ProfitabilityAdvisorInput {
  productName: string;
  unitCostUSD: number;
  targetMarginPercent: number;
  requiredSellingPrice: number;
  marketAverage: number | null;
  isBelowMarketAverage: boolean;
}

export function buildUserMessage(input: ProfitabilityAdvisorInput): string {
  return `Product: ${input.productName}
Unit cost USD: ${input.unitCostUSD}
Target margin: ${input.targetMarginPercent}%
Required selling price: K${input.requiredSellingPrice.toFixed(2)}
Market average: ${input.marketAverage !== null ? 'K' + input.marketAverage.toFixed(2) : 'no data'}
${input.isBelowMarketAverage ? 'WARNING: Below market average' : 'OK vs market'}`;
}
