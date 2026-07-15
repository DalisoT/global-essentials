/**
 * Server-side implementations of the AI CFO tool schemas (Phase 3 / 3A.2).
 *
 * Each function in `cfoToolHandlers` takes an authenticated Supabase client
 * and a typed arg object, and returns a JSON-serializable result that the
 * engine (3A.3) appends to the model conversation.
 *
 * Conventions:
 *   - Every handler returns `{ ok: true, data: T } | { ok: false, error: string }`
 *     so the engine can surface errors back to the model instead of crashing.
 *   - Date math uses `new Date()` evaluated once per call. Bucket boundaries
 *     use calendar days, not business days — matches the dashboard convention.
 *   - Numbers are rounded to 2 decimal places at the boundary to keep the
 *     model context small (no floating-point noise in the JSON).
 *
 * The 4 "thin wrapper" tools re-use the existing Phase-1 / Phase-2 actions
 * (getPnL, getTrialBalance, getTopProductsByProfit, getBalanceSheet). The 2
 * new tools (get_aging_debts, get_slow_moving_stock) are implemented inline.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getDateRangeFromPreset,
  type DateRangePreset,
} from '@/lib/actions/accounting-utils';
import { getPnL, getTrialBalance, getBalanceSheet } from '@/lib/actions/accounting';
import { getTopProductsByProfit } from '@/lib/actions/profitability';
import {
  computeDemandForecast,
  computeCashflowForecast,
} from '@/lib/actions/forecast';
import type {
  ForecastCashflowArgs,
  ForecastDemandArgs,
  GetAgingDebtsArgs,
  GetCashPositionArgs,
  GetPnLArgs,
  GetSlowMovingStockArgs,
  GetTopProductsArgs,
  GetTrialBalanceArgs,
} from './tools';

// ─────────────────────────────────────────────────────────────────────
// Result envelope
// ─────────────────────────────────────────────────────────────────────

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T>(data: T): ToolResult<T> => ({ ok: true, data });
const fail = (error: string): ToolResult<never> => ({ ok: false, error });

/** Round to 2dp and force a number (handles nulls from SUM aggregates). */
const r2 = (n: number | null | undefined): number =>
  Math.round((Number(n) || 0) * 100) / 100;

// ─────────────────────────────────────────────────────────────────────
// 1. get_pnl
// ─────────────────────────────────────────────────────────────────────

async function handleGetPnL(
  supabase: SupabaseClient,
  args: GetPnLArgs
): Promise<ToolResult> {
  const range = getDateRangeFromPreset(args.preset as DateRangePreset);
  const result = await getPnL(range);
  if (result.error || !result.data) {
    return fail(result.error || 'No P&L data');
  }
  const d = result.data;
  return ok({
    preset: args.preset,
    range,
    revenue: r2(d.totalRevenue),
    cogs: r2(d.cogs),
    grossProfit: r2(d.grossProfit),
    operatingExpenses: r2(d.operatingExpenses),
    netProfit: r2(d.netProfit),
    rows: d.rows.map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type,
      amount: r2(r.amount),
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 2. get_trial_balance
// ─────────────────────────────────────────────────────────────────────

async function handleGetTrialBalance(
  supabase: SupabaseClient,
  args: GetTrialBalanceArgs
): Promise<ToolResult> {
  const range = getDateRangeFromPreset(args.preset as DateRangePreset);
  const result = await getTrialBalance(range);
  if (result.error) return fail(result.error);
  return ok({
    preset: args.preset,
    range,
    totalDebit: r2(result.totalDebit),
    totalCredit: r2(result.totalCredit),
    balanced:
      result.totalDebit !== undefined &&
      result.totalCredit !== undefined &&
      Math.abs(result.totalDebit - result.totalCredit) < 0.01,
    rows: (result.rows || []).map((r) => ({
      code: r.code,
      name: r.name,
      type: r.type,
      debit: r2(r.debit),
      credit: r2(r.credit),
      balance: r2(r.balance),
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 3. get_top_products
// ─────────────────────────────────────────────────────────────────────

async function handleGetTopProducts(
  supabase: SupabaseClient,
  args: GetTopProductsArgs
): Promise<ToolResult> {
  const limit = Math.max(1, Math.min(20, args.limit ?? 5));
  const result = await getTopProductsByProfit(
    args.preset as DateRangePreset,
    limit
  );
  if (result.error) return fail(result.error);
  return ok({
    preset: args.preset,
    limit,
    products: (result.data || []).map((p) => ({
      name: p.name,
      profit: r2(p.profit),
      revenue: r2(p.revenue),
      units: p.units,
      grossMarginPct: Math.round((p.gross_margin_pct || 0) * 10) / 10,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 4. get_aging_debts  (NEW — not a thin wrapper)
// ─────────────────────────────────────────────────────────────────────

async function handleGetAgingDebts(
  supabase: SupabaseClient,
  _args: GetAgingDebtsArgs
): Promise<ToolResult> {
  // We pull the full set of unpaid installments and compute aging client-side.
  // This is fine up to ~10k rows (well within the small-business scale of this
  // app). For larger books, replace with a Postgres view that returns the
  // bucketed totals directly.
  const { data, error } = await supabase
    .from('installments')
    .select('amount_due, amount_paid, due_date, is_paid')
    .eq('is_paid', false);

  if (error) return fail(error.message);

  type Row = { amount_due: number; amount_paid: number | null; due_date: string; is_paid: boolean };
  const rows = (data || []) as Row[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type Bucket = {
    label: string;
    daysMin: number;
    daysMax: number;
    count: number;
    totalDue: number;
    totalPartiallyPaid: number;
  };

  const buckets: Bucket[] = [
    { label: 'current',    daysMin: -Infinity, daysMax: -1,         count: 0, totalDue: 0, totalPartiallyPaid: 0 },
    { label: '0-30',       daysMin: 0,         daysMax: 30,         count: 0, totalDue: 0, totalPartiallyPaid: 0 },
    { label: '31-60',      daysMin: 31,        daysMax: 60,         count: 0, totalDue: 0, totalPartiallyPaid: 0 },
    { label: '61-90',      daysMin: 61,        daysMax: 90,         count: 0, totalDue: 0, totalPartiallyPaid: 0 },
    { label: '90+',        daysMin: 91,        daysMax: Infinity,   count: 0, totalDue: 0, totalPartiallyPaid: 0 },
  ];

  let totalDue = 0;
  let totalPartiallyPaid = 0;
  let totalCount = 0;
  let oldestOverdueDays = 0;

  for (const r of rows) {
    const due = new Date(r.due_date);
    due.setHours(0, 0, 0, 0);
    const ms = today.getTime() - due.getTime();
    const daysOverdue = Math.floor(ms / (1000 * 60 * 60 * 24));

    // Skip rows whose balance is already 0 (partially paid up to amount_due)
    const remaining = r.amount_due - (r.amount_paid || 0);
    if (remaining <= 0) continue;

    totalDue += remaining;
    totalPartiallyPaid += r.amount_paid || 0;
    totalCount += 1;

    const bucket = buckets.find(
      (b) => daysOverdue >= b.daysMin && daysOverdue <= b.daysMax
    );
    if (bucket) {
      bucket.count += 1;
      bucket.totalDue += remaining;
      bucket.totalPartiallyPaid += r.amount_paid || 0;
    }

    if (daysOverdue > oldestOverdueDays) oldestOverdueDays = daysOverdue;
  }

  return ok({
    asOf: today.toISOString().split('T')[0],
    totalCount,
    totalDue: r2(totalDue),
    totalPartiallyPaid: r2(totalPartiallyPaid),
    oldestOverdueDays,
    buckets: buckets.map((b) => ({
      label: b.label,
      daysRange: b.daysMin === -Infinity
        ? 'not yet due'
        : b.daysMax === Infinity
          ? `${b.daysMin}+`
          : b.daysMin === b.daysMax
            ? `${b.daysMin}`
            : `${b.daysMin}-${b.daysMax}`,
      count: b.count,
      totalDue: r2(b.totalDue),
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 5. get_cash_position  (thin wrapper around getBalanceSheet, filtered)
// ─────────────────────────────────────────────────────────────────────

/** Account codes that count as "cash" for the cash position tool. */
const CASH_ACCOUNT_CODES = ['1000', '1010', '1020'] as const;

async function handleGetCashPosition(
  supabase: SupabaseClient,
  _args: GetCashPositionArgs
): Promise<ToolResult> {
  const today = new Date().toISOString().split('T')[0];
  const result = await getBalanceSheet(today);
  if (result.error || !result.data) {
    return fail(result.error || 'No balance sheet');
  }

  const cashAccounts = result.data.rows
    .filter((r) => CASH_ACCOUNT_CODES.includes(r.code as (typeof CASH_ACCOUNT_CODES)[number]))
    .map((r) => ({
      code: r.code,
      name: r.name,
      balance: r2(r.balance),
    }));

  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);

  // Receivable is the other half of the liquidity picture. Pulled from the
  // same balance sheet (Accounts Receivable = code 1200).
  const receivable = result.data.rows.find((r) => r.code === '1200');
  const payables = result.data.rows.find((r) => r.code === '2000');

  return ok({
    asOf: today,
    totalCash: r2(totalCash),
    accounts: cashAccounts,
    accountsReceivable: receivable ? r2(receivable.balance) : 0,
    accountsPayable: payables ? r2(payables.balance) : 0,
    netWorkingCapital: r2(
      totalCash +
        (receivable ? receivable.balance : 0) -
        (payables ? payables.balance : 0)
    ),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 6. get_slow_moving_stock  (NEW — not a thin wrapper)
// ─────────────────────────────────────────────────────────────────────

interface SlowMovingRow {
  id: string;
  name: string;
  stock_level: number;
  cost_price: number;
  selling_price: number;
  image_url: string | null;
  last_sale_at: string | null;
  units_in_period: number;
  days_since_last_sale: number | null;
  stock_value_at_cost: number;
  potential_profit: number;
}

async function handleGetSlowMovingStock(
  supabase: SupabaseClient,
  args: GetSlowMovingStockArgs
): Promise<ToolResult> {
  const limit = Math.max(1, Math.min(50, args.limit ?? 10));

  // 1) Active products with stock.
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, stock_level, cost_price, selling_price, image_url')
    .is('deleted_at', null)
    .gt('stock_level', 0);

  if (prodErr) return fail(prodErr.message);
  if (!products || products.length === 0) {
    return ok({ asOf: new Date().toISOString().split('T')[0], rows: [] });
  }

  // 2) Recent sales (last 90 days) for velocity + last-sale date.
  // 90 days is the conventional "dead stock" window for retail. If you need
  // longer horizons, expose this as a tool arg later.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffIso = ninetyDaysAgo.toISOString();

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('product_id, quantity, created_at')
    .is('deleted_at', null)
    .gte('created_at', cutoffIso);

  if (salesErr) return fail(salesErr.message);

  type Sale = { product_id: string; quantity: number | null; created_at: string };
  const saleRows = (sales || []) as Sale[];

  // 3) Aggregate per product.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const productMap = new Map<string, SlowMovingRow>();
  for (const p of products as Array<{
    id: string;
    name: string;
    stock_level: number;
    cost_price: number;
    selling_price: number;
    image_url: string | null;
  }>) {
    productMap.set(p.id, {
      id: p.id,
      name: p.name,
      stock_level: p.stock_level,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      image_url: p.image_url,
      last_sale_at: null,
      units_in_period: 0,
      days_since_last_sale: null,
      stock_value_at_cost: r2(p.cost_price * p.stock_level),
      potential_profit: r2((p.selling_price - p.cost_price) * p.stock_level),
    });
  }

  for (const s of saleRows) {
    const row = productMap.get(s.product_id);
    if (!row) continue;
    row.units_in_period += s.quantity ?? 1;
    if (!row.last_sale_at || s.created_at > row.last_sale_at) {
      row.last_sale_at = s.created_at;
    }
  }

  // 4) Compute days_since_last_sale.
  productMap.forEach((row) => {
    if (row.last_sale_at) {
      const d = new Date(row.last_sale_at);
      d.setHours(0, 0, 0, 0);
      row.days_since_last_sale = Math.floor(
        (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  });

  // 5) Sort: longest-stagnant first, then highest stock value.
  const sorted = Array.from(productMap.values()).sort((a, b) => {
    // Null days_since_last_sale (never sold in window) goes to the top.
    const aDays = a.days_since_last_sale ?? 9999;
    const bDays = b.days_since_last_sale ?? 9999;
    if (aDays !== bDays) return bDays - aDays;
    return b.stock_value_at_cost - a.stock_value_at_cost;
  });

  return ok({
    asOf: today.toISOString().split('T')[0],
    windowDays: 90,
    rows: sorted.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      stockLevel: r.stock_level,
      unitsSoldInWindow: r.units_in_period,
      daysSinceLastSale: r.days_since_last_sale,
      lastSaleAt: r.last_sale_at,
      stockValueAtCost: r.stock_value_at_cost,
      potentialProfitIfSold: r.potential_profit,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 7. forecast_demand  (Phase 7.9 — predictive AI)
// ─────────────────────────────────────────────────────────────────────

async function handleForecastDemand(
  supabase: SupabaseClient,
  args: ForecastDemandArgs
): Promise<ToolResult> {
  const productId = String(args.product_id ?? '').trim();
  if (!productId) return fail('product_id is required');
  const days = Math.max(1, Math.min(90, Number(args.days) || 30));

  const res = await computeDemandForecast(supabase, productId, days);
  if (res.error || !res.data) return fail(res.error ?? 'Forecast failed');

  const payload = res.data;
  // Compact the series to save model context. We drop the bounds
  // for the long series (the model rarely needs them) and keep
  // the aggregate stats front-and-centre.
  const totalPredicted = r2(
    payload.series.reduce((a, b) => a + b.predicted_qty, 0)
  );
  const avgPerDay = r2(totalPredicted / Math.max(1, days));

  return ok({
    productId,
    horizonDays: days,
    totalPredicted,
    avgPerDay,
    confidence: payload.confidence,
    methodLabel: payload.method_label,
    series: payload.series.map((p) => ({
      date: p.date,
      predictedQty: p.predicted_qty,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// 8. forecast_cashflow  (Phase 7.9 — predictive AI)
// ─────────────────────────────────────────────────────────────────────

async function handleForecastCashflow(
  supabase: SupabaseClient,
  args: ForecastCashflowArgs
): Promise<ToolResult> {
  const days = Math.max(1, Math.min(90, Number(args.days) || 30));

  const res = await computeCashflowForecast(supabase, days);
  if (res.error || !res.data) return fail(res.error ?? 'Forecast failed');

  const payload = res.data;
  return ok({
    horizonDays: days,
    totalInflow: payload.total_inflow,
    totalOutflow: payload.total_outflow,
    endCash: payload.end_cash,
    minCashDay: payload.min_cash_day,
    minCashAmount: payload.min_cash_amount,
    series: payload.series.map((p) => ({
      date: p.date,
      inflow: p.inflow,
      outflow: p.outflow,
      net: p.net,
      cumulative: p.cumulative,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch table
// ─────────────────────────────────────────────────────────────────────

/**
 * A tool handler receives the authenticated Supabase client and the raw,
 * JSON-parsed args the model produced. Each handler is responsible for
 * narrowing `args` to its expected shape (a `Zod` schema would be cleaner
 * here, but adding Zod for 6 tools is overkill — runtime guards are fine).
 *
 * We type args as `any` so the dispatch table can hold handlers with
 * heterogeneous arg types without TS variance complaints.
 */
type ToolHandler = (supabase: SupabaseClient, args: any) => Promise<ToolResult>;

/**
 * Map of tool name (snake_case) → handler. The engine looks up by name
 * after parsing `choice.message.tool_calls[*].function.name` from Groq.
 */
export const cfoToolHandlers: Record<string, ToolHandler> = {
  get_pnl: handleGetPnL,
  get_trial_balance: handleGetTrialBalance,
  get_top_products: handleGetTopProducts,
  get_aging_debts: handleGetAgingDebts,
  get_cash_position: handleGetCashPosition,
  get_slow_moving_stock: handleGetSlowMovingStock,
  forecast_demand: handleForecastDemand,
  forecast_cashflow: handleForecastCashflow,
};
