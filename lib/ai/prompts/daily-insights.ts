/**
 * Daily insights prompt (QW.1).
 *
 * Used by `lib/actions/insights.ts → getDailyInsights`. Caller builds a
 * snapshot of the dashboard stats and the model returns exactly 3
 * short bullets in a strict JSON array.
 *
 * Extracted from inline constant in `lib/actions/insights.ts` as part of
 * ROADMAP.md#3A.1.
 */

export const meta = {
  id: 'daily-insights' as const,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.5,
  maxTokens: 400,
} as const;

export const system = `You are a concise business advisor for a small retail shop.
Given today's snapshot of the business, produce exactly 3 short bullet points
that tell the owner what to focus on today.

Rules:
- Each bullet ≤ 140 characters.
- Plain English, no jargon, no emojis, no markdown.
- Each bullet must reference at least one concrete number from the snapshot.
- Order: 1) the most important thing to do today, 2) a risk or warning, 3) a positive signal.
- For each bullet also assign a tone from: positive | warning | action | info.
- Output ONLY a valid JSON array of 3 objects: [{"text":"...","tone":"..."}, ...].
  No prose, no explanation, no markdown fences.`;

export interface DailyInsightsSnapshot {
  /** Pre-formatted currency string. */
  groundTruth: string;
  /** Pre-formatted currency string. */
  inPipeline: string;
  lowStockCount: number;
  upcomingDuesCount: number;
}

export function buildUserMessage(input: DailyInsightsSnapshot): string {
  return `Today's snapshot:
- Ground Truth (paid sales − expenses): ${input.groundTruth}
- In Pipeline (unpaid installments): ${input.inPipeline}
- Low stock items needing restock: ${input.lowStockCount}
- Upcoming installments due in next 7 days: ${input.upcomingDuesCount}

Return the JSON array now.`;
}
