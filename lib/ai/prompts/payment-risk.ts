/**
 * Payment risk analysis prompt.
 *
 * Used by `lib/actions/ai.ts → analyzePaymentRisk`. Takes the client's
 * payment history and returns a small JSON {risk, message, recommendation}.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'payment-risk' as const,
  model: 'llama-3.3-70b-versatile',
  /** Lower temp for analytical tasks. */
  temperature: 0.3,
  maxTokens: 256,
} as const;

export const system = `You are a credit risk analyst. Analyze the payment history and provide a risk assessment.
Return a JSON object with:
- risk: "low", "medium", or "high"
- message: A brief explanation (1 sentence)
- recommendation: One actionable suggestion (1 sentence)`;

export interface PaymentRiskInput {
  clientName: string;
  /** Pre-formatted currency string. */
  totalDebt: string;
  overdueCount: number;
  onTimePayments: number;
  latePayments: number;
}

export function buildUserMessage(input: PaymentRiskInput): string {
  return `Analyze payment risk for ${input.clientName}:
- Total outstanding debt: ${input.totalDebt}
- Number of overdue installments: ${input.overdueCount}
- On-time payments: ${input.onTimePayments}
- Late payments: ${input.latePayments}`;
}
