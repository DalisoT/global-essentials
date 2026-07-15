'use server';

/**
 * Predictive AI / Forecasting (Phase 7).
 *
 * Three server actions live here, one per forecast kind:
 *   - forecastDemand(productId, days)   — 7.2
 *   - forecastCashFlow(days)             — 7.3
 *   - predictDefaults(clientId)          — 7.4
 *
 * All three follow the same pattern:
 *   1. Look up a cached row in `forecasts` for (kind, target_id, horizon_days).
 *      If it's still fresh (expires_at > now), return it.
 *   2. Otherwise, compute a fresh forecast with the algorithm in this file.
 *   3. UPSERT into `forecasts` (replacing the stale row).
 *   4. Return the new forecast.
 *
 * The v1 algorithms are deliberately simple — moving averages and rule
 * logic, no LLM calls. This keeps them fast (sub-100ms), predictable,
 * and quota-free. The model column in the DB records the algorithm so
 * we can layer in AI-powered forecasts later without changing the
 * contract.
 *
 * The nightly Vercel Cron (7.8) regenerates expired forecasts in the
 * background, so the on-demand path is the cache-warming fallback
 * (e.g. when a user opens a page for a product that has no cached
 * forecast yet).
 */

import { requireAuth } from '@/lib/supabase-server';
import type {
  Forecast,
  DemandForecastPayload,
  CashflowForecastPayload,
  DefaultRiskForecastPayload,
} from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Common helpers
// ─────────────────────────────────────────────────────────────────────

/** How long a generated forecast is considered fresh. */
const FORECAST_TTL_DAYS = 1;

/** A safe round that handles JS float weirdness. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Today in the user's local timezone (Africa/Lusaka). YYYY-MM-DD. */
function localDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Date offset by N days. Returns YYYY-MM-DD. */
function addDays(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return localDateString(dt);
}

// ─────────────────────────────────────────────────────────────────────
// 7.2 — forecastDemand(productId, days)
// ─────────────────────────────────────────────────────────────────────

const DEMAND_HISTORY_DAYS = 30;
const DEMAND_MOVING_AVG_DAYS = 14;
/** Width of the confidence band, as a fraction of the predicted qty. */
const DEMAND_BAND_FRACTION = 0.25;

/**
 * Return a demand forecast for one product. Delegates to the core
 * helper, which is shared with the cron (7.8). The action layer
 * only handles auth + the cache contract.
 *
 * Algorithm (v1) lives in computeDemandForecast below.
 */
export async function forecastDemand(
  productId: string,
  days: number
): Promise<{ data?: Forecast; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;
  return forceRegenerateForecast(supabase, 'demand', productId, days);
}

// ─────────────────────────────────────────────────────────────────────
// 7.3 — forecastCashFlow(days)
// ─────────────────────────────────────────────────────────────────────

/**
 * Project the business's cash position for the next `days` days.
 *
 * Inflows come from:
 *   - Installments with due_date in the horizon and status != 'paid'
 *
 * Outflows come from:
 *   - Expenses with due_date (or created_at, if no due_date) in the
 *     horizon. We use created_at as a simple heuristic.
 *
 * Algorithm (v1):
 *   1. Get current cash-on-hand from getDashboardStats (single call,
 *      shared with the dashboard).
 *   2. Build a daily series: for each of the next N days, sum the
 *      inflows and outflows for that day. No AI, no seasonality.
 *   3. Compute the running cumulative cash position.
 *   4. Surface the min_cash day + the end_cash.
 *
 * The result is conservative: it only counts things that are already
 * on the books (scheduled installments, logged expenses). It does
 * NOT predict new sales.
 */
export async function forecastCashFlow(
  days: number
): Promise<{ data?: Forecast; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;
  return forceRegenerateForecast(supabase, 'cashflow', null, days);
}

// ─────────────────────────────────────────────────────────────────────
// 7.4 — predictDefaults(clientId)
// ─────────────────────────────────────────────────────────────────────

/**
 * Score a client's probability of missing the next installment.
 *
 * Algorithm (v1) — weighted rule-based score, no AI:
 *   - Has any 90+ day overdue installment?   +0.40
 *   - Has any 30-90 day overdue?             +0.20
 *   - 2+ installments in 30-day overdue?     +0.15
 *   - Paid 0 installments on time in 90d?    +0.15
 *   - Active loan with all on-time?          -0.10 (cap at 0)
 *   - < 3 total installments ever?           -0.10 (cap at 0; new client)
 *
 * Bands:
 *   - < 0.30  -> 'low'
 *   - 0.30-0.60 -> 'medium'
 *   - >= 0.60  -> 'high'
 */
export async function predictDefaults(
  clientId: string
): Promise<{ data?: Forecast; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;
  return forceRegenerateForecast(supabase, 'default_risk', clientId, 30);
}

// ─────────────────────────────────────────────────────────────────────
// Cache helpers (shared by all three actions)
// ─────────────────────────────────────────────────────────────────────

interface CachedLookup {
  supabase: Awaited<ReturnType<typeof requireAuth>> extends infer R
    ? R extends { supabase: infer S }
      ? S
      : never
    : never;
}

async function getCachedForecast(
  supabase: CachedLookup['supabase'],
  kind: 'demand' | 'cashflow' | 'default_risk',
  targetId: string | null,
  horizonDays: number
): Promise<Forecast | null> {
  let q = supabase
    .from('forecasts')
    .select('*')
    .eq('kind', kind)
    .eq('horizon_days', horizonDays)
    .gt('expires_at', new Date().toISOString());
  // target_id filter — PostgREST treats NULL as a real value, so we
  // branch on nullability.
  if (targetId == null) {
    q = q.is('target_id', null);
  } else {
    q = q.eq('target_id', targetId);
  }
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return (data as Forecast | null) ?? null;
}

interface UpsertInput {
  kind: 'demand' | 'cashflow' | 'default_risk';
  target_id: string | null;
  horizon_days: number;
  payload: Record<string, unknown>;
  model: string;
}

async function upsertForecast(
  supabase: CachedLookup['supabase'],
  input: UpsertInput
): Promise<{ data?: Forecast; error?: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FORECAST_TTL_DAYS * 24 * 60 * 60 * 1000);

  // We do a delete + insert rather than an upsert: target_id is
  // NULLable, so the natural unique key (kind, target_id, horizon_days)
  // is not a real Postgres UNIQUE constraint. A clean delete-then-insert
  // keeps the cache tidy (one row per natural key).
  let delQ = supabase
    .from('forecasts')
    .delete()
    .eq('kind', input.kind)
    .eq('horizon_days', input.horizon_days);
  if (input.target_id == null) {
    delQ = delQ.is('target_id', null);
  } else {
    delQ = delQ.eq('target_id', input.target_id);
  }
  const { error: delError } = await delQ;
  if (delError) return { error: delError.message };

  const { data, error } = await supabase
    .from('forecasts')
    .insert([{
      kind: input.kind,
      target_id: input.target_id,
      horizon_days: input.horizon_days,
      payload: input.payload,
      model: input.model,
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }])
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { data: data as Forecast };
}

// FORECAST_TTL_DAYS is referenced by the nightly cron (7.8) — it
// should hardcode or import from a non-'use server' file. We
// intentionally do not re-export it from this module because the
// 'use server' directive forbids non-async exports.

// ─────────────────────────────────────────────────────────────────────
// Core helpers (shared by 7.2-7.7 + 7.8 cron)
//
// These take a `supabase` client directly so they can be called
// from a service-role context (cron, webhooks) OR a user context
// (dashboard, inventory). The user-facing actions above are
// thin wrappers that call requireAuth() and then delegate here.
// ─────────────────────────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof requireAuth>> extends infer R
  ? R extends { supabase: infer S }
    ? S
    : never
  : never;

export async function computeDemandForecast(
  supabase: SupabaseClient,
  productId: string,
  days: number
): Promise<{ data?: DemandForecastPayload; error?: string }> {
  if (!productId) return { error: 'productId is required' };
  if (typeof days !== 'number' || days < 1 || days > 90) {
    return { error: 'days must be between 1 and 90' };
  }

  // Cache check.
  const cached = await getCachedForecast(supabase, 'demand', productId, days);
  if (cached) {
    return { data: cached.payload as unknown as DemandForecastPayload };
  }

  // Compute fresh.
  const since = new Date();
  since.setDate(since.getDate() - DEMAND_HISTORY_DAYS);
  const { data: salesRows, error: salesError } = await supabase
    .from('sales')
    .select('quantity, created_at')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .gte('created_at', since.toISOString());

  if (salesError) return { error: salesError.message };

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const perDay = new Map<string, number>();
  for (const row of (salesRows ?? []) as Array<{ quantity: number; created_at: string }>) {
    const day = fmt.format(new Date(row.created_at));
    perDay.set(day, (perDay.get(day) ?? 0) + (row.quantity ?? 0));
  }

  const today = localDateString();
  const historyDays: number[] = [];
  for (let i = DEMAND_HISTORY_DAYS - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    historyDays.push(perDay.get(day) ?? 0);
  }
  const window = historyDays.slice(-DEMAND_MOVING_AVG_DAYS);
  const sum = window.reduce((a, b) => a + b, 0);
  const movingAvg = window.length > 0 ? sum / window.length : 0;
  const nonZeroDays = historyDays.filter((q) => q > 0).length;
  const confidence = Math.max(0.1, Math.min(1, 0.1 + (nonZeroDays / DEMAND_HISTORY_DAYS) * 0.9));

  const series: DemandForecastPayload['series'] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(today, i);
    const predicted = r2(movingAvg);
    series.push({
      date,
      predicted_qty: predicted,
      lower: r2(Math.max(0, predicted * (1 - DEMAND_BAND_FRACTION))),
      upper: r2(predicted * (1 + DEMAND_BAND_FRACTION)),
    });
  }

  return {
    data: {
      series,
      confidence: r2(confidence),
      method_label: `${DEMAND_MOVING_AVG_DAYS}-day moving average`,
    },
  };
}

export async function computeCashflowForecast(
  supabase: SupabaseClient,
  days: number
): Promise<{ data?: CashflowForecastPayload; error?: string }> {
  if (typeof days !== 'number' || days < 1 || days > 90) {
    return { error: 'days must be between 1 and 90' };
  }

  const cached = await getCachedForecast(supabase, 'cashflow', null, days);
  if (cached) {
    return { data: cached.payload as unknown as CashflowForecastPayload };
  }

  const { getDashboardStats } = await import('@/lib/actions/dashboard');
  const statsRes = await getDashboardStats();
  const openingCash = (statsRes as { data?: { groundTruth?: number } }).data?.groundTruth ?? 0;

  const today = new Date();
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + days);
  const { data: installments, error: instError } = await supabase
    .from('installments')
    .select('amount_due, due_date, status')
    .neq('status', 'paid')
    .gte('due_date', today.toISOString().slice(0, 10))
    .lte('due_date', horizonEnd.toISOString().slice(0, 10));

  if (instError) return { error: instError.message };

  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('amount, created_at')
    .is('deleted_at', null)
    .gte('created_at', today.toISOString())
    .lte('created_at', horizonEnd.toISOString());

  if (expError) return { error: expError.message };

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const inflowsByDay = new Map<string, number>();
  const outflowsByDay = new Map<string, number>();
  for (const inst of (installments ?? []) as Array<{
    amount_due: number;
    due_date: string;
  }>) {
    const day = (inst.due_date ?? '').slice(0, 10);
    inflowsByDay.set(day, (inflowsByDay.get(day) ?? 0) + (inst.amount_due ?? 0));
  }
  for (const exp of (expenses ?? []) as Array<{ amount: number; created_at: string }>) {
    const day = fmt.format(new Date(exp.created_at));
    outflowsByDay.set(day, (outflowsByDay.get(day) ?? 0) + (exp.amount ?? 0));
  }

  const todayStr = localDateString();
  const series: CashflowForecastPayload['series'] = [];
  let cumulative = openingCash;
  let totalIn = 0;
  let totalOut = 0;
  let minCash = openingCash;
  let minCashDay = todayStr;
  for (let i = 1; i <= days; i++) {
    const date = addDays(todayStr, i);
    const inflow = inflowsByDay.get(date) ?? 0;
    const outflow = outflowsByDay.get(date) ?? 0;
    cumulative = r2(cumulative + inflow - outflow);
    totalIn = r2(totalIn + inflow);
    totalOut = r2(totalOut + outflow);
    if (cumulative < minCash) {
      minCash = cumulative;
      minCashDay = date;
    }
    series.push({ date, inflow, outflow, net: r2(inflow - outflow), cumulative });
  }

  return {
    data: {
      series,
      total_inflow: totalIn,
      total_outflow: totalOut,
      end_cash: cumulative,
      min_cash_day: minCashDay,
      min_cash_amount: minCash,
    },
  };
}

export async function computeDefaultRiskForecast(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ data?: DefaultRiskForecastPayload; error?: string }> {
  if (!clientId) return { error: 'clientId is required' };

  const cached = await getCachedForecast(supabase, 'default_risk', clientId, 30);
  if (cached) {
    return { data: cached.payload as unknown as DefaultRiskForecastPayload };
  }

  const { data: installments, error: instError } = await supabase
    .from('installments')
    .select('amount_due, amount_paid, due_date, status, paid_at')
    .eq('client_id', clientId);

  if (instError) return { error: instError.message };

  const rows = (installments ?? []) as Array<{
    amount_due: number;
    amount_paid?: number;
    due_date: string;
    status: string;
    paid_at?: string | null;
  }>;

  const now = new Date();
  let score = 0;
  const factors: DefaultRiskForecastPayload['factors'] = [];
  let overdue30 = 0;
  let overdue90 = 0;
  let onTimeCount = 0;
  for (const r of rows) {
    const due = new Date(r.due_date);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / msPerDay);
    if (r.status === 'paid' && r.paid_at && daysOverdue <= 0) {
      onTimeCount += 1;
    } else if (daysOverdue > 90) {
      overdue90 += 1;
    } else if (daysOverdue > 30) {
      overdue30 += 1;
    }
  }
  if (overdue90 > 0) {
    score += 0.4;
    factors.push({ label: `${overdue90} installment(s) overdue 90+ days`, impact: 0.4 });
  }
  if (overdue30 > 0) {
    score += 0.2;
    factors.push({ label: `${overdue30} installment(s) 30-90 days overdue`, impact: 0.2 });
  }
  if (overdue30 >= 2) {
    score += 0.15;
    factors.push({ label: '2+ installments in the 30-90 day bucket', impact: 0.15 });
  }
  if (onTimeCount === 0 && rows.length > 0) {
    score += 0.15;
    factors.push({ label: 'No on-time payments in history', impact: 0.15 });
  }
  if (rows.length >= 3 && overdue30 === 0 && overdue90 === 0) {
    score -= 0.1;
    factors.push({ label: '3+ installments, none overdue', impact: -0.1 });
  }
  if (rows.length < 3) {
    score -= 0.1;
    factors.push({ label: 'New client (<3 installments on file)', impact: -0.1 });
  }

  score = Math.max(0, Math.min(1, score));
  const risk_band: DefaultRiskForecastPayload['risk_band'] =
    score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';

  return {
    data: {
      probability: r2(score),
      risk_band,
      factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    },
  };
}

/**
 * Regenerate a single forecast kind for a given (target_id, horizon_days)
 * using a caller-supplied supabase client (e.g. service-role for the cron).
 * Bypasses the cache to force a fresh write.
 */
export async function forceRegenerateForecast(
  supabase: SupabaseClient,
  kind: 'demand' | 'cashflow' | 'default_risk',
  targetId: string | null,
  horizonDays: number
): Promise<{ data?: Forecast; error?: string }> {
  let payload: Record<string, unknown> | null = null;
  let model = 'simple-moving-avg';

  if (kind === 'demand' && targetId) {
    const res = await computeDemandForecast(supabase, targetId, horizonDays);
    if (res.error) return { error: res.error };
    payload = res.data as unknown as Record<string, unknown>;
    model = 'simple-moving-avg';
  } else if (kind === 'cashflow') {
    const res = await computeCashflowForecast(supabase, horizonDays);
    if (res.error) return { error: res.error };
    payload = res.data as unknown as Record<string, unknown>;
    model = 'rule-based';
  } else if (kind === 'default_risk' && targetId) {
    const res = await computeDefaultRiskForecast(supabase, targetId);
    if (res.error) return { error: res.error };
    payload = res.data as unknown as Record<string, unknown>;
    model = 'rule-based';
  } else {
    return { error: `Invalid kind/target combination: ${kind} / ${targetId}` };
  }

  if (!payload) return { error: 'No payload produced' };

  return upsertForecast(supabase, {
    kind,
    target_id: targetId,
    horizon_days: horizonDays,
    payload,
    model,
  });
}

// ─────────────────────────────────────────────────────────────────────
// 7.7 — getReorderAlerts()
//
// Scans the user's active products, fetches each product's cached
// 30-day demand forecast, and returns the ones where the current
// stock will run out BEFORE the supplier lead time + safety buffer.
// These are the products the owner should reorder now.
//
// Algorithm:
//   - avg_daily = total predicted qty over 30 days / 30
//   - days_until_stockout = current_stock / avg_daily
//   - safety_buffer_days = 7
//   - reorder_needed = days_until_stockout < lead_time_days + safety_buffer
//
// We only include products with at least some sales history
// (avg_daily > 0) so dead stock doesn't pollute the list.
// ─────────────────────────────────────────────────────────────────────

const REORDER_HORIZON_DAYS = 30;
const REORDER_SAFETY_BUFFER_DAYS = 7;

export interface ReorderAlert {
  productId: string;
  productName: string;
  currentStock: number;
  leadTimeDays: number;
  avgDailyDemand: number;
  daysUntilStockout: number; // Infinity for products with no demand
  /** Suggested reorder quantity: (lead_time + safety_buffer) * avg_daily. */
  suggestedOrderQty: number;
  /** Forecast method label, for transparency. */
  methodLabel: string;
}

export async function getReorderAlerts(): Promise<{
  data?: ReorderAlert[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  // 1) Pull all active products with their stock + lead time.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, stock_level, lead_time_days')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (productsError) return { error: productsError.message };
  if (!products || products.length === 0) return { data: [] };

  type ProductRow = {
    id: string;
    name: string;
    stock_level: number;
    lead_time_days: number | null;
  };

  // 2) For each product, fetch the cached 30-day demand forecast.
  //    Sequential because the underlying cache hit is fast and the
  //    list is small (~tens of products typically). We could
  //    parallelise later if needed.
  const alerts: ReorderAlert[] = [];
  for (const p of products as ProductRow[]) {
    const leadTime = p.lead_time_days ?? 7;
    const forecastRes = await forecastDemand(p.id, REORDER_HORIZON_DAYS);
    if (forecastRes.error || !forecastRes.data) continue;
    const payload = forecastRes.data.payload as unknown as DemandForecastPayload;
    const totalPredicted = payload.series.reduce((a, b) => a + b.predicted_qty, 0);
    const avgDaily = totalPredicted / REORDER_HORIZON_DAYS;
    if (avgDaily <= 0) continue; // dead stock, skip

    const daysUntilStockout = p.stock_level / avgDaily;
    const reorderThreshold = leadTime + REORDER_SAFETY_BUFFER_DAYS;
    if (daysUntilStockout >= reorderThreshold) continue;

    const suggestedOrderQty = Math.ceil(reorderThreshold * avgDaily);

    alerts.push({
      productId: p.id,
      productName: p.name,
      currentStock: p.stock_level ?? 0,
      leadTimeDays: leadTime,
      avgDailyDemand: r2(avgDaily),
      daysUntilStockout: r2(daysUntilStockout),
      suggestedOrderQty,
      methodLabel: payload.method_label,
    });
  }

  // 3) Sort: most urgent first (fewest days until stockout).
  alerts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

  return { data: alerts };
}
