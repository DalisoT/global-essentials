/**
 * Natural-language analytics prompt.
 *
 * Used by `app/api/ai-analytics/route.ts`. Caller pre-aggregates the
 * dashboard-style data (revenue, expenses, top products, last 7 days) and
 * the model answers a free-form question over it.
 *
 * Extracted from inline `groq.chat.completions.create` call as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'analytics' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  maxTokens: 1024,
} as const;

export const system = `You are a business intelligence analyst for "Global Essentials", a POS and debt management system.
Answer questions about the business data provided. Be concise, insightful, and actionable.
Format your response nicely with bullet points or sections when appropriate.
Keep responses under 300 words.`;

export interface AnalyticsData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  groundTruth: number;
  inPipeline: number;
  topProducts: Array<{ name: string; count: number; revenue: number }>;
  revenueByDay: Array<{ date: string; amount: number }>;
}

export interface AnalyticsInput {
  query: string;
  data: AnalyticsData;
}

export function buildUserMessage(input: AnalyticsInput): string {
  const d = input.data;
  return `Business Data:
- Total Revenue: $${d.totalRevenue.toFixed(2)}
- Total Expenses: $${d.totalExpenses.toFixed(2)}
- Net Profit: $${d.netProfit.toFixed(2)}
- Ground Truth (Paid Sales - Expenses): $${d.groundTruth.toFixed(2)}
- In Pipeline (Unpaid Installments): $${d.inPipeline.toFixed(2)}
- Top Products: ${d.topProducts.map((p) => `${p.name} (${p.count} sold, $${p.revenue.toFixed(2)} revenue)`).join(', ') || 'None yet'}
- Last 7 Days Revenue: ${d.revenueByDay.map((d) => `${d.date}: $${d.amount.toFixed(2)}`).join(', ') || 'No data'}

Question: ${input.query}`;
}
