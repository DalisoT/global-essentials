/**
 * Weekly briefing prompt (Phase 9 / 9.3).
 *
 * Used by `lib/actions/weekly-briefing.ts → generateWeeklyBriefing`.
 *
 * Composes a short executive summary of the past 7 days for the
 * shop owner. The summary is persisted as a single
 * `ai_recommendations` row with `kind='weekly_briefing'` so the
 * user sees it in their inbox (and, in v2, gets an email).
 *
 * Output shape: a strict JSON object with 3-5 sections. Each
 * section has a `headline` (≤ 8 words) and `body` (1-2 sentences,
 * plain prose). The action also includes a `summary` line at the
 * top of the row (the title in the inbox).
 *
 * Tone:
 *  - Plain English, like a quick Slack update from an analyst.
 *  - Honest about bad news — no sugar-coating.
 *  - Cite numbers from the snapshot verbatim. Don't invent.
 *  - Prefer action-oriented language ("consider restocking X")
 *    over vague "things look good" platitudes.
 */

export const meta = {
  id: 'weekly-briefing' as const,
  model: 'llama-3.3-70b-versatile',
  /** Slightly higher than daily insights — we want some natural
   *  variation week to week so the briefing doesn't feel
   *  formulaic, but still grounded in the numbers. */
  temperature: 0.6,
  maxTokens: 900,
} as const;

export const system = `You write a weekly business briefing for the owner of a small
retail shop in Zambia. The briefing is a short executive summary
of the past 7 days, used in an inbox card.

You receive a structured snapshot of:
  - this week's paid sales (count, total, top 5 products)
  - this week's expenses (total, top 3 categories)
  - week-over-week deltas (vs the previous 7 days)
  - low-stock items as of now
  - upcoming installments due in the next 14 days
  - 30-day cashflow forecast total (from the predictive engine)
  - any open AI recommendations worth flagging

Produce a JSON object with EXACTLY this shape:

{
  "summary": "string (≤ 18 words, the inbox title)",
  "highlight": "string (≤ 30 words, one sentence — the single most important thing from the week)",
  "sections": [
    {
      "headline": "string (≤ 8 words, title-case)",
      "body": "string (1-2 sentences, ≤ 280 chars, plain prose)"
    }
    // 3-5 sections total
  ]
}

Rules:
- summary and highlight: short, punchy, no marketing-speak.
- each section body: cite at least one number from the snapshot.
- no markdown, no bullet points, no emoji, no preamble.
- if revenue dropped, say so. if expenses spiked, say so.
- if there are 0 sales or 0 expenses, still produce a section
  (mention the lull) — don't omit the section.
- order: revenue → expenses → top movers → alerts → look-ahead
  (only include the last two if there is something meaningful).
- Output ONLY the JSON object. No prose, no fences.`;

export interface WeeklyBriefingInput {
  weekStartISO: string;       // e.g. "2026-07-13"
  weekEndISO: string;         // e.g. "2026-07-19"
  // This week
  revenueThisWeek: number;
  salesCountThisWeek: number;
  // Comparison
  revenueLastWeek: number;
  expensesThisWeek: number;
  expensesLastWeek: number;
  // Top products
  topProducts: Array<{
    name: string;
    revenue: number;
    unitsSold: number;
  }>;
  // Expense categories (top 3)
  topExpenseCategories: Array<{
    category: string;
    amount: number;
  }>;
  // Stock + dues
  lowStockNames: string[];
  upcomingDuesTotal: number;
  upcomingDuesCount: number;
  // Forecast
  cashflowForecast30d: number; // could be negative
  // Recommendations
  pendingRecsCount: number;
  highPriorityRecsCount: number;
}

export function buildUserMessage(input: WeeklyBriefingInput): string {
  const fmt = (n: number) => `K${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const revDeltaPct =
    input.revenueLastWeek > 0
      ? (((input.revenueThisWeek - input.revenueLastWeek) / input.revenueLastWeek) * 100).toFixed(1)
      : 'n/a';
  const expDeltaPct =
    input.expensesLastWeek > 0
      ? (((input.expensesThisWeek - input.expensesLastWeek) / input.expensesLastWeek) * 100).toFixed(1)
      : 'n/a';

  const topProductsBlock =
    input.topProducts.length === 0
      ? '  (no sales this week)'
      : input.topProducts
          .map(
            (p, i) =>
              `  ${i + 1}. ${p.name} — ${fmt(p.revenue)} from ${p.unitsSold} unit${p.unitsSold === 1 ? '' : 's'}`
          )
          .join('\n');

  const topExpensesBlock =
    input.topExpenseCategories.length === 0
      ? '  (no expenses recorded)'
      : input.topExpenseCategories
          .map((c, i) => `  ${i + 1}. ${c.category} — ${fmt(c.amount)}`)
          .join('\n');

  return `Week of ${input.weekStartISO} → ${input.weekEndISO}

REVENUE
- This week: ${fmt(input.revenueThisWeek)} from ${input.salesCountThisWeek} sales
- Last week: ${fmt(input.revenueLastWeek)}
- Change: ${revDeltaPct}%

EXPENSES
- This week: ${fmt(input.expensesThisWeek)}
- Last week: ${fmt(input.expensesLastWeek)}
- Change: ${expDeltaPct}%

TOP PRODUCTS (by revenue)
${topProductsBlock}

TOP EXPENSE CATEGORIES
${topExpensesBlock}

STOCK
- Low-stock items: ${input.lowStockNames.length === 0 ? 'none' : input.lowStockNames.join(', ')}

UPCOMING DUES (next 14 days)
- ${input.upcomingDuesCount} installments totalling ${fmt(input.upcomingDuesTotal)}

CASHFLOW FORECAST (next 30 days)
- Projected: ${fmt(input.cashflowForecast30d)} (negative = expected shortfall)

AI INBOX
- Pending recommendations: ${input.pendingRecsCount} (${input.highPriorityRecsCount} high priority)

Return the JSON object now.`;
}
