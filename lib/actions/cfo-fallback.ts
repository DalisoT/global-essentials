/**
 * Fallback answer builder for the AI CFO Copilot (Phase 3 / 3C.3).
 *
 * Runs when the engine in `cfo-engine.ts` can't reach Groq (network down,
 * 5xx, rate-limit response, etc.). We still want the user to get *some*
 * useful answer instead of just "I couldn't reach the AI."
 *
 * Strategy: simple keyword routing picks the most likely tool the user
 * would have wanted, calls it directly with sensible defaults, and wraps
 * the result in a templated plain-text response.
 *
 * Limitations (acceptable for v1):
 *   - Keyword matching is brittle. A user asking "what's my runway?"
 *     might want a forecast (Phase 7) or just cash position; we pick
 *     cash position. The badge in the UI tells them it's a fallback.
 *   - We only call one tool. If the question really needs two (like
 *     E10: top product + cash), the fallback is necessarily incomplete.
 *   - The text is templated, not synthesised. It's correct but reads
 *     like a report, not a conversation.
 *
 * The right upgrade path is to retry Groq with exponential backoff first,
 * then fall back here only after N failures. That's a Phase 4 item.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/lib/utils';
import { cfoToolHandlers } from '@/lib/ai/cfo-tools';

export interface FallbackResult {
  /** Plain-text answer for the user. */
  answer: string;
  /** Tool name that was called (for the audit log + UI disclosure). */
  toolName: string;
  /** True if the keyword router matched; false = default route. */
  matched: boolean;
}

const HEADER =
  "I couldn't reach the AI right now, but here's the raw data from your books:";

/**
 * Inspect a question with a tiny keyword router and call the best-matching
 * tool directly. Returns a formatted text answer + a record of which tool
 * was called so the UI can show a "fallback" badge.
 */
export async function buildFallbackAnswer(
  supabase: SupabaseClient,
  question: string
): Promise<FallbackResult> {
  const q = question.toLowerCase();
  const matched = pickTool(q);

  // Call the tool directly via the same dispatch table the engine uses.
  // We use a no-op Auth context because the tools themselves will go
  // through requireAuth() again — that's safe, just an extra check.
  const handler = cfoToolHandlers[matched.tool];
  let toolResult: { ok: true; data: unknown } | { ok: false; error: string };
  try {
    toolResult = (await handler(supabase, matched.args)) as typeof toolResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      answer: `${HEADER}\n\nThe fallback tool (${matched.tool}) also failed: ${msg}\n\nPlease try again in a moment when the AI is back.`,
      toolName: matched.tool,
      matched: matched.wasExplicit,
    };
  }

  if (!toolResult.ok) {
    return {
      answer: `${HEADER}\n\nThe fallback tool (${matched.tool}) returned an error: ${toolResult.error}\n\nPlease try again in a moment when the AI is back.`,
      toolName: matched.tool,
      matched: matched.wasExplicit,
    };
  }

  return {
    answer: `${HEADER}\n\n${formatToolResult(matched.tool, toolResult.data)}`,
    toolName: matched.tool,
    matched: matched.wasExplicit,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Result type aliases — kept inline so the formatters stay type-safe
// without depending on the action modules' full type surface.
// ─────────────────────────────────────────────────────────────────────

interface PnLData {
  preset: string;
  range?: { from: string; to: string };
  revenue?: number;
  cogs?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  netProfit?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Keyword router
// ─────────────────────────────────────────────────────────────────────

interface Route {
  tool: string;
  args: Record<string, unknown>;
  /** True if the keyword match was explicit (not the default). */
  wasExplicit: boolean;
  /** Match priority: lower number wins. Used to break ties. */
  priority: number;
}

function pickTool(question: string): Route {
  // Order: most specific phrases first. First match wins.
  // Each rule is checked in priority order; the first one whose keywords
  // all appear in the question wins.
  const rules: Array<{ keywords: string[]; route: Route }> = [
    // Trial balance — most specific phrases first
    {
      keywords: ['trial balance', 'books balanced', 'reconcile', 'reconciliation'],
      route: { tool: 'get_trial_balance', args: { preset: 'all' }, wasExplicit: true, priority: 0 },
    },
    // Aging / overdue — needs to come before generic "debt"
    {
      keywords: ['overdue', 'who owes', 'aging', 'late payment'],
      route: { tool: 'get_aging_debts', args: {}, wasExplicit: true, priority: 1 },
    },
    // Slow / dead stock
    {
      keywords: ['dead stock', 'slow moving', 'slow stock', 'stagnant', 'discount', 'sitting'],
      route: { tool: 'get_slow_moving_stock', args: { limit: 10 }, wasExplicit: true, priority: 2 },
    },
    // Top products
    {
      keywords: ['top product', 'best sell', 'top sell', 'best-sell', 'most popular', 'top performer'],
      route: { tool: 'get_top_products', args: { preset: 'month', limit: 5 }, wasExplicit: true, priority: 3 },
    },
    // Cash position
    {
      keywords: ['cash on hand', 'cash position', 'how much cash', 'how much money', 'liquidity', 'runway'],
      route: { tool: 'get_cash_position', args: {}, wasExplicit: true, priority: 4 },
    },
    // P&L — last because "profit" / "loss" / "revenue" are catch-alls
    {
      keywords: ['profit', 'loss', 'p&l', 'p and l', 'revenue', 'income', 'earnings', 'expense', 'net'],
      route: { tool: 'get_pnl', args: { preset: 'month' }, wasExplicit: true, priority: 5 },
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((k) => question.includes(k))) {
      return rule.route;
    }
  }

  // No keyword match → fall through to the safest default: P&L.
  return { tool: 'get_pnl', args: { preset: 'month' }, wasExplicit: false, priority: 99 };
}

// ─────────────────────────────────────────────────────────────────────
// Result formatter
// ─────────────────────────────────────────────────────────────────────

/**
 * Format a tool result into a short, human-readable plain-text answer.
 * Each branch knows the shape of its tool's data and renders accordingly.
 */
function formatToolResult(toolName: string, data: unknown): string {
  if (data == null) return '(no data)';

  switch (toolName) {
    case 'get_pnl':
      return formatPnL(data as PnLData);
    case 'get_trial_balance':
      return formatTrialBalance(data as { totalDebit: number; totalCredit: number; balanced: boolean });
    case 'get_top_products':
      return formatTopProducts(data as Array<{ name: string; units: number; profit: number; revenue: number; grossMarginPct: number }>);
    case 'get_aging_debts':
      return formatAging(data as { totalCount: number; totalDue: number; oldestOverdueDays: number; buckets: Array<{ label: string; count: number; totalDue: number; daysRange: string }> });
    case 'get_cash_position':
      return formatCashPosition(data as { totalCash: number; accounts: Array<{ code: string; name: string; balance: number }>; accountsReceivable: number; accountsPayable: number; netWorkingCapital: number });
    case 'get_slow_moving_stock':
      return formatSlowMoving(data as { windowDays: number; rows: Array<{ name: string; stockLevel: number; unitsSoldInWindow: number; daysSinceLastSale: number | null; stockValueAtCost: number; potentialProfitIfSold: number }> });
    default:
      return `(${toolName} returned: ${JSON.stringify(data)})`;
  }
}

function formatPnL(d: any): string {
  if (!d) return 'No P&L data available.';
  return [
    `Period: ${d.preset} (${d.range?.from} → ${d.range?.to})`,
    `Revenue: ${formatCurrency(d.revenue ?? 0)}`,
    `Cost of goods sold: ${formatCurrency(d.cogs ?? 0)}`,
    `Gross profit: ${formatCurrency(d.grossProfit ?? 0)}`,
    `Operating expenses: ${formatCurrency(d.operatingExpenses ?? 0)}`,
    `Net profit: ${formatCurrency(d.netProfit ?? 0)}`,
  ].join('\n');
}


function formatTrialBalance(d: any): string {
  if (!d) return 'No trial balance data.';
  const balanced = d.balanced ? 'Balanced ✅' : 'Out of balance ❌';
  return [
    `Period: ${d.preset}`,
    `Total debits: ${formatCurrency(d.totalDebit ?? 0)}`,
    `Total credits: ${formatCurrency(d.totalCredit ?? 0)}`,
    `Status: ${balanced}`,
  ].join('\n');
}

function formatTopProducts(products: any[]): string {
  if (!products || products.length === 0) return 'No product sales in this period.';
  const lines = products.map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${p.units} units, ${formatCurrency(p.revenue)} revenue, ${formatCurrency(p.profit)} profit, ${p.grossMarginPct?.toFixed?.(1) ?? '?'}% margin`
  );
  return `Top ${products.length} products by profit:\n\n${lines.join('\n')}`;
}

function formatAging(d: any): string {
  if (!d) return 'No aging data.';
  const lines = (d.buckets ?? []).map(
    (b: any) => `  ${b.label.padEnd(10)} (${b.daysRange}): ${b.count} installment${b.count === 1 ? '' : 's'}, ${formatCurrency(b.totalDue)}`
  );
  return [
    `Aging as of ${d.asOf}:`,
    '',
    ...lines,
    '',
    `Total: ${d.totalCount} installment${d.totalCount === 1 ? '' : 's'}, ${formatCurrency(d.totalDue)}`,
    `Oldest overdue: ${d.oldestOverdueDays} days`,
  ].join('\n');
}

function formatCashPosition(d: any): string {
  if (!d) return 'No cash position data.';
  const acctLines = (d.accounts ?? []).map((a: any) => `  ${a.name}: ${formatCurrency(a.balance)}`);
  return [
    `Cash position as of ${d.asOf}:`,
    '',
    ...acctLines,
    '',
    `Total cash: ${formatCurrency(d.totalCash ?? 0)}`,
    `Accounts receivable: ${formatCurrency(d.accountsReceivable ?? 0)}`,
    `Accounts payable: ${formatCurrency(d.accountsPayable ?? 0)}`,
    `Net working capital: ${formatCurrency(d.netWorkingCapital ?? 0)}`,
  ].join('\n');
}

function formatSlowMoving(d: any): string {
  if (!d || !d.rows || d.rows.length === 0) return `No slow-moving stock in the last ${d?.windowDays ?? 90} days.`;
  const lines = d.rows.map((r: any) => {
    const days = r.daysSinceLastSale == null ? 'never sold' : `${r.daysSinceLastSale}d ago`;
    return `  ${r.name} — ${r.stockLevel} units, last sold ${days}, ${formatCurrency(r.stockValueAtCost)} tied up`;
  });
  return `Slow-moving stock (last ${d.windowDays} days):\n\n${lines.join('\n')}`;
}
