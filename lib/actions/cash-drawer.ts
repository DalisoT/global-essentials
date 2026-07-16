'use server';

/**
 * Cash drawer reconciliation (Phase 12 / E).
 *
 * End-of-day ritual:
 *   1. Count what's in the drawer → `closing_cash`.
 *   2. System computes `expected_cash` from opening + the
 *      day's paid sales (we treat all sales as cash for v1;
 *      a future iteration should split by payment method)
 *      minus any cash expenses.
 *   3. Variance = closing - expected. Stored.
 *
 * One log per day (UNIQUE on log_date). The user can re-submit
 * the same day if they made a counting mistake — the latest
 * log wins.
 */

import { requireAuth } from '@/lib/supabase-server';
import type { CashDrawerLog } from '@/lib/supabase-types';

function localDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDays(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export interface ExpectedCashBreakdown {
  opening: number;
  cashSales: number;
  cashExpenses: number;
  preOrderDeposits: number;
  expected: number;
}

export interface ExpectedCashResult {
  data: ExpectedCashBreakdown;
  error?: string;
}

/**
 * Compute the expected cash in the drawer at close of
 * `dateISO`. v1 assumes all sales are cash and all expenses
 * are cash — good enough for a small shop. A future
 * iteration should split by payment_method.
 */
export async function computeExpectedCash(
  dateISO: string
): Promise<ExpectedCashResult> {
  const auth = await requireAuth();
  if ('error' in auth) return { data: { opening: 0, cashSales: 0, cashExpenses: 0, preOrderDeposits: 0, expected: 0 }, error: auth.error };
  const { supabase } = auth;

  // Get the most recent cash_drawer_logs.log_date strictly
  // before `dateISO` — that's the opening cash for the day.
  const { data: prev } = await supabase
    .from('cash_drawer_logs')
    .select('closing_cash, log_date')
    .lt('log_date', dateISO)
    .order('log_date', { ascending: false })
    .limit(1);
  const opening = (prev && prev[0] ? Number((prev[0] as { closing_cash: number }).closing_cash) : 0);

  // Paid sales on this date (v1: all counted as cash)
  const { data: sales } = await supabase
    .from('sales')
    .select('total_amount')
    .eq('payment_status', 'paid')
    .gte('created_at', `${dateISO}T00:00:00`)
    .lte('created_at', `${dateISO}T23:59:59.999`);
  const cashSales = (sales ?? []).reduce(
    (s, r) => s + (Number((r as { total_amount: number }).total_amount) || 0),
    0
  );

  // Expenses on this date (v1: all counted as cash)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .gte('created_at', `${dateISO}T00:00:00`)
    .lte('created_at', `${dateISO}T23:59:59.999`);
  const cashExpenses = (expenses ?? []).reduce(
    (s, r) => s + (Number((r as { amount: number }).amount) || 0),
    0
  );

  // Pre-order deposits received today (counted as cash for v1)
  const { data: preOrders } = await supabase
    .from('pre_orders')
    .select('deposit_amount, deposit_paid_at')
    .not('deposit_paid_at', 'is', null)
    .gte('deposit_paid_at', `${dateISO}T00:00:00`)
    .lte('deposit_paid_at', `${dateISO}T23:59:59.999`);
  const preOrderDeposits = (preOrders ?? []).reduce(
    (s, r) => s + (Number((r as { deposit_amount: number }).deposit_amount) || 0),
    0
  );

  const expected = opening + cashSales - cashExpenses + preOrderDeposits;

  return {
    data: {
      opening,
      cashSales,
      cashExpenses,
      preOrderDeposits,
      expected,
    },
  };
}

export interface SubmitDrawerLogInput {
  /** YYYY-MM-DD. Defaults to today (Lusaka). */
  log_date?: string;
  opening_cash: number;
  closing_cash: number;
  /** Optional override — the user can manually adjust if the
   *  system's computation is off (e.g. they know the bank
   *  deposit happened but it's not in the ledger yet). */
  expected_override?: number;
  notes?: string;
}

export async function submitDrawerLog(
  input: SubmitDrawerLogInput
): Promise<{ data?: CashDrawerLog; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (input.opening_cash < 0 || input.closing_cash < 0) {
    return { error: 'Cash amounts must be ≥ 0' };
  }

  const log_date = input.log_date ?? localDateString();

  // Compute the expected amount, unless the user overrode it.
  let expected = input.expected_override;
  if (expected === undefined) {
    const exp = await computeExpectedCash(log_date);
    expected = exp.data.expected;
  }

  const variance = input.closing_cash - expected;

  // Upsert: UNIQUE on log_date means a re-submit overwrites.
  const { data, error } = await supabase
    .from('cash_drawer_logs')
    .upsert(
      [{
        log_date,
        opening_cash: input.opening_cash,
        closing_cash: input.closing_cash,
        expected_cash: expected,
        variance,
        notes: input.notes?.trim().slice(0, 500) ?? null,
        submitted_by: userId,
      }],
      { onConflict: 'log_date' }
    )
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { data: data as unknown as CashDrawerLog };
}

export async function getDrawerLog(
  log_date: string
): Promise<{ data?: CashDrawerLog; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;
  const { data, error } = await supabase
    .from('cash_drawer_logs')
    .select('*')
    .eq('log_date', log_date)
    .maybeSingle();
  if (error) return { error: error.message };
  return { data: (data ?? undefined) as CashDrawerLog | undefined };
}

export interface ListDrawerLogsFilter {
  limit?: number;
  /** Days back from today. */
  lookback_days?: number;
}

export async function listDrawerLogs(
  filter: ListDrawerLogsFilter = {}
): Promise<{ data?: CashDrawerLog[]; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;
  const limit = Math.max(1, Math.min(200, filter.limit ?? 30));
  const since = localDateString(new Date(Date.now() - (filter.lookback_days ?? 60) * 24 * 60 * 60 * 1000));
  const { data, error } = await supabase
    .from('cash_drawer_logs')
    .select('*')
    .gte('log_date', since)
    .order('log_date', { ascending: false })
    .limit(limit);
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as CashDrawerLog[] };
}
