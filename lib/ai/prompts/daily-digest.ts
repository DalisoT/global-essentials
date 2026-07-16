/**
 * Daily digest prompt (Phase 12 / D).
 *
 * Used by `lib/actions/daily-digest.ts → generateDailyDigest`.
 * Composes a short 3-line summary of the past 24 hours for
 * the shop owner. The summary is persisted as a
 * `kind='custom'` recommendation so the user sees it in
 * their inbox the next morning.
 *
 * Tone: even shorter and more actionable than the weekly
 * briefing. The user just wants to know how the day went
 * and what to focus on tomorrow.
 */

export const meta = {
  id: 'daily-digest' as const,
  model: 'llama-3.3-70b-versatile',
  /** Lower than weekly briefing — we want a stable daily shape. */
  temperature: 0.4,
  maxTokens: 400,
} as const;

export const system = `You write a daily end-of-day digest for the owner of a small retail shop in Zambia.
The digest is shown in the inbox as a single card with a title and a short body.

You receive a structured snapshot of today:
  - today's paid sales (count, total)
  - yesterday's paid sales (for comparison)
  - today's expenses
  - top product today
  - number of active pre-orders
  - new pre-orders today
  - any open anomalies flagged by the detector
  - any open high-priority AI recommendations

Produce a JSON object with EXACTLY this shape:

{
  "summary": "string (≤ 14 words, the inbox title)",
  "highlight": "string (≤ 22 words, one sentence — the single most important takeaway from the day)",
  "tomorrow": "string (≤ 22 words, one concrete suggestion for tomorrow morning)"
}

Rules:
- summary and highlight: short, direct, no marketing-speak.
- Every number must come from the snapshot. Never invent.
- If a section has zero data, say so plainly (e.g. "No expenses today").
- tomorrow: ONE specific action, not a wishlist. If pre-orders are pending, suggest following up. If expenses spiked, suggest reviewing them.
- Output ONLY the JSON object. No prose, no fences.`;

export interface DailyDigestInput {
  dateISO: string;             // YYYY-MM-DD for "today"
  // Sales
  revenueToday: number;
  salesCountToday: number;
  revenueYesterday: number;
  // Expenses
  expensesToday: number;
  // Top product
  topProduct: { name: string; revenue: number; unitsSold: number } | null;
  // Pre-orders
  preOrdersActive: number;
  preOrdersNewToday: number;
  // Anomalies
  anomalies: Array<{ kind: string; title: string }>;
  // Recommendations
  highPriorityRecsCount: number;
}

export function buildUserMessage(input: DailyDigestInput): string {
  const fmt = (n: number) => `K${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const revDeltaPct =
    input.revenueYesterday > 0
      ? (((input.revenueToday - input.revenueYesterday) / input.revenueYesterday) * 100).toFixed(0)
      : 'n/a';
  const anomaliesBlock =
    input.anomalies.length === 0
      ? '  (none)'
      : input.anomalies
          .slice(0, 3)
          .map((a) => `  - ${a.kind}: ${a.title}`)
          .join('\n');

  return `Today: ${input.dateISO}

SALES
- Revenue today: ${fmt(input.revenueToday)} from ${input.salesCountToday} sales
- Revenue yesterday: ${fmt(input.revenueYesterday)}
- Change: ${revDeltaPct}%

EXPENSES
- Today: ${fmt(input.expensesToday)}

TOP PRODUCT TODAY
- ${input.topProduct ? `${input.topProduct.name} — ${fmt(input.topProduct.revenue)} from ${input.topProduct.unitsSold} units` : 'no sales today'}

PRE-ORDERS
- Active: ${input.preOrdersActive}
- New today: ${input.preOrdersNewToday}

ANOMALIES DETECTED TODAY
${anomaliesBlock}

HIGH-PRIORITY RECOMMENDATIONS
- ${input.highPriorityRecsCount} open

Return the JSON object now.`;
}
