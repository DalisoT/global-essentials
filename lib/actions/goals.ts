'use server';

/**
 * Goals (Phase 9 / 9.5).
 *
 * The owner can set revenue / profit / cash-buffer targets on
 * a weekly or monthly cadence. The system measures current
 * progress and emits `kind='goal_progress'` rows in
 * `ai_recommendations` so the user sees how they're tracking
 * in the inbox.
 *
 * Public surface:
 *
 *   READ
 *     - getActiveGoals()           all active goals
 *     - getGoalProgress(goalId)    progress for one goal
 *     - getAllGoalProgress()       progress for every active goal
 *
 *   WRITE
 *     - createGoal(input)
 *     - updateGoal(id, patch)
 *     - deactivateGoal(id)         soft delete (keeps history)
 *
 *   EMIT
 *     - syncGoalProgressRecs()     upserts one
 *                                 kind='goal_progress' row per
 *                                 active goal, idempotent on
 *                                 (kind, related_id=goalId).
 *                                 Called by the dashboard and
 *                                 the cron (after forecast regen
 *                                 and anomaly detection).
 *
 * The action layer is the only writer for goal_progress
 * recs — the inbox is read-only elsewhere.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth, createServiceRoleClient } from '@/lib/supabase-server';
import type {
  AIRecommendation,
  Goal,
  GoalKind,
  GoalPeriod,
  GoalProgress,
} from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────────────────

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

/**
 * First day (Monday) of the week containing `dateStr`.
 * */
function startOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 0 = Sun, 1 = Mon, ...
  const dow = dt.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(dateStr, -back);
}

function startOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

function endOfWeek(dateStr: string): string {
  return addDays(startOfWeek(dateStr), 6);
}

function endOfMonth(dateStr: string): string {
  const ym = dateStr.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  // First day of next month minus 1.
  const next = new Date(Date.UTC(y, m, 1));
  const last = new Date(next.getTime() - 24 * 60 * 60 * 1000);
  const yy = last.getUTCFullYear();
  const mm = String(last.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(last.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  kind: GoalKind;
  title: string;
  target_amount: number;
  period: GoalPeriod;
  /** YYYY-MM-DD. Optional — defaults to the current period start. */
  period_start?: string;
}

export async function createGoal(
  input: CreateGoalInput
): Promise<{ data?: Goal; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  if (!input.title || input.title.length > 100) {
    return { error: 'title is required and must be ≤ 100 chars' };
  }
  if (!Number.isFinite(input.target_amount) || input.target_amount <= 0) {
    return { error: 'target_amount must be > 0' };
  }

  const today = localDateString();
  const periodStart =
    input.period_start ??
    (input.period === 'weekly' ? startOfWeek(today) : startOfMonth(today));
  const periodEnd =
    input.period === 'weekly' ? endOfWeek(periodStart) : endOfMonth(periodStart);

  const { data, error } = await supabase
    .from('goals')
    .insert([{
      kind: input.kind,
      title: input.title.slice(0, 100),
      target_amount: input.target_amount,
      period: input.period,
      period_start: periodStart,
      period_end: periodEnd,
      is_active: true,
    }])
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { data: data as unknown as Goal };
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, 'title' | 'target_amount' | 'is_active'>>
): Promise<{ data?: Goal; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === 'string') update.title = patch.title.slice(0, 100);
  if (typeof patch.target_amount === 'number' && patch.target_amount > 0) {
    update.target_amount = patch.target_amount;
  }
  if (typeof patch.is_active === 'boolean') update.is_active = patch.is_active;

  const { data, error } = await supabase
    .from('goals')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { error: error.message };
  return { data: data as unknown as Goal };
}

/** Soft-delete: sets is_active=false. History is preserved. */
export async function deactivateGoal(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from('goals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function getActiveGoals(): Promise<{
  data?: Goal[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as Goal[] };
}

// ─────────────────────────────────────────────────────────────────────
// Progress measurement
// ─────────────────────────────────────────────────────────────────────

/**
 * Compute current_value for a single goal by aggregating
 * sales + expenses between period_start and period_end
 * (or today, whichever is earlier).
 */
async function computeCurrentValue(
  supabase: SupabaseClient,
  goal: Goal
): Promise<number> {
  const today = localDateString();
  const end = goal.period_end && goal.period_end < today ? goal.period_end : today;
  // We pull the same shape of data the dashboard uses, then
  // compute on the server. This is cheap even with thousands
  // of rows because we're windowed to a single period.
  if (goal.kind === 'revenue') {
    const { data } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', `${goal.period_start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59.999`);
    return (data ?? []).reduce((s, r) => s + ((r as { total_amount: number }).total_amount ?? 0), 0);
  }
  if (goal.kind === 'profit') {
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', `${goal.period_start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59.999`);
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .gte('created_at', `${goal.period_start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59.999`);
    const rev = (sales ?? []).reduce((s, r) => s + ((r as { total_amount: number }).total_amount ?? 0), 0);
    const exp = (expenses ?? []).reduce((s, r) => s + ((r as { amount: number }).amount ?? 0), 0);
    return rev - exp;
  }
  if (goal.kind === 'cash_buffer') {
    // For cash_buffer, current_value = ground truth. We
    // compute it inline using the same logic as the dashboard
    // so the user gets the same number.
    const { data: paidSales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'paid');
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('amount');
    const rev = (paidSales ?? []).reduce((s, r) => s + ((r as { total_amount: number }).total_amount ?? 0), 0);
    const exp = (allExpenses ?? []).reduce((s, r) => s + ((r as { amount: number }).amount ?? 0), 0);
    return rev - exp;
  }
  return 0;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24)
  );
}

export async function getGoalProgress(goalId: string): Promise<{
  data?: GoalProgress;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .maybeSingle();
  if (goalError) return { error: goalError.message };
  if (!goal) return { error: 'Goal not found' };

  const g = goal as unknown as Goal;
  const current_value = await computeCurrentValue(supabase, g);
  const today = localDateString();
  const endDate = g.period_end && g.period_end < today ? g.period_end : today;
  const days_remaining = g.period_end ? Math.max(0, daysBetween(today, g.period_end)) : 0;
  const remainingTarget = Math.max(0, g.target_amount - current_value);
  const needed_per_day =
    days_remaining > 0 ? remainingTarget / days_remaining : remainingTarget;
  const progress_pct =
    g.target_amount > 0
      ? Math.round((current_value / g.target_amount) * 100)
      : 0;

  return {
    data: {
      ...g,
      current_value,
      progress_pct,
      days_remaining,
      needed_per_day,
      on_track: current_value >= g.target_amount,
    },
  };
}

export async function getAllGoalProgress(): Promise<{
  data?: GoalProgress[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };

  const out: GoalProgress[] = [];
  for (const g of (goals ?? []) as Goal[]) {
    const current_value = await computeCurrentValue(supabase, g);
    const today = localDateString();
    const endDate = g.period_end && g.period_end < today ? g.period_end : today;
    const days_remaining = g.period_end ? Math.max(0, daysBetween(today, g.period_end)) : 0;
    const remainingTarget = Math.max(0, g.target_amount - current_value);
    const needed_per_day =
      days_remaining > 0 ? remainingTarget / days_remaining : remainingTarget;
    const progress_pct =
      g.target_amount > 0
        ? Math.round((current_value / g.target_amount) * 100)
        : 0;
    out.push({
      ...g,
      current_value,
      progress_pct,
      days_remaining,
      needed_per_day,
      on_track: current_value >= g.target_amount,
    });
    // Reference endDate so TS doesn't complain (we use it for
    // explicit clarity in the comment but the persisted row
    // is computed against `today`).
    void endDate;
  }
  return { data: out };
}

// ─────────────────────────────────────────────────────────────────────
// Recommendation sync
// ─────────────────────────────────────────────────────────────────────

const fmtK = (n: number) =>
  `K${Math.round(n).toLocaleString('en-US')}`;

function buildGoalProgressRec(
  g: GoalProgress
): { title: string; body: string; priority: 'low' | 'medium' | 'high'; payload: Record<string, unknown> } {
  const pct = g.progress_pct;
  if (g.on_track) {
    return {
      title: `Goal met: ${g.title}`,
      body:
        `You've hit your ${g.kind} target for this ${g.period}: ` +
        `${fmtK(g.current_value)} vs ${fmtK(g.target_amount)} (${pct}%). ` +
        `Consider raising the bar for the next period.`,
      priority: 'low',
      payload: {
        goal_id: g.id,
        kind: g.kind,
        period: g.period,
        target: g.target_amount,
        current: g.current_value,
        progress_pct: pct,
        state: 'met',
      },
    };
  }
  if (g.days_remaining === 0) {
    return {
      title: `Goal missed: ${g.title}`,
      body:
        `The ${g.period} has ended and you reached ${fmtK(g.current_value)} ` +
        `of your ${fmtK(g.target_amount)} ${g.kind} target (${pct}%). ` +
        `Set a new goal for the next period.`,
      priority: 'low',
      payload: {
        goal_id: g.id,
        kind: g.kind,
        period: g.period,
        target: g.target_amount,
        current: g.current_value,
        progress_pct: pct,
        state: 'missed',
      },
    };
  }
  // Still time. Decide priority by how far off they are.
  // <50% with >50% of period gone: high. <80% with <20% time left: high. Otherwise medium.
  const periodLen = g.period === 'weekly' ? 7 : 30;
  const elapsedPct = Math.max(0, 100 - Math.round((g.days_remaining / periodLen) * 100));
  const priority: 'low' | 'medium' | 'high' =
    (pct < 50 && elapsedPct > 50) || (pct < 80 && g.days_remaining <= 2)
      ? 'high'
      : 'medium';
  return {
    title: `${pct}% of ${g.title}`,
    body:
      `You're at ${fmtK(g.current_value)} of your ${fmtK(g.target_amount)} ` +
      `${g.kind} target (${pct}%) with ${g.days_remaining} day${g.days_remaining === 1 ? '' : 's'} left. ` +
      `To hit it, you need ${fmtK(g.needed_per_day)} per day from here.`,
    priority,
    payload: {
      goal_id: g.id,
      kind: g.kind,
      period: g.period,
      target: g.target_amount,
      current: g.current_value,
      progress_pct: pct,
      days_remaining: g.days_remaining,
      needed_per_day: g.needed_per_day,
      state: 'tracking',
    },
  };
}

export async function syncGoalProgressRecs(
  supabase: SupabaseClient
): Promise<{ ok: boolean; updated: number; message?: string }> {
  const { data: goals, error: gError } = await supabase
    .from('goals')
    .select('*')
    .eq('is_active', true);
  if (gError) return { ok: false, updated: 0, message: gError.message };

  let updated = 0;
  for (const g of (goals ?? []) as Goal[]) {
    const current_value = await computeCurrentValue(supabase, g);
    const today = localDateString();
    const days_remaining = g.period_end ? Math.max(0, daysBetween(today, g.period_end)) : 0;
    const remainingTarget = Math.max(0, g.target_amount - current_value);
    const needed_per_day =
      days_remaining > 0 ? remainingTarget / days_remaining : remainingTarget;
    const progress_pct =
      g.target_amount > 0
        ? Math.round((current_value / g.target_amount) * 100)
        : 0;
    const progress: GoalProgress = {
      ...g,
      current_value,
      progress_pct,
      days_remaining,
      needed_per_day,
      on_track: current_value >= g.target_amount,
    };
    const rec = buildGoalProgressRec(progress);

    // Upsert: natural key (kind='goal_progress', related_id=goalId).
    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('id, status')
      .eq('kind', 'goal_progress')
      .eq('related_id', g.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({
          title: rec.title,
          body: rec.body,
          payload: rec.payload,
          priority: rec.priority,
        })
        .eq('id', (existing as { id: string }).id);
      if (error) return { ok: false, updated, message: error.message };
    } else {
      const { error } = await supabase
        .from('ai_recommendations')
        .insert([{
          kind: 'goal_progress',
          title: rec.title,
          body: rec.body,
          payload: rec.payload,
          priority: rec.priority,
          status: 'pending',
          source_action: 'syncGoalProgressRecs',
          related_id: g.id,
        }]);
      if (error) return { ok: false, updated, message: error.message };
    }
    updated += 1;
  }
  return { ok: true, updated };
}

/** Cron-friendly wrapper. */
export async function runGoalProgressCron(): Promise<{ ok: boolean; updated: number; message?: string }> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      updated: 0,
      message: e instanceof Error ? e.message : 'Failed to create service-role client',
    };
  }
  return syncGoalProgressRecs(supabase);
}

// Reference AIRecommendation so the import is consumed.
export type { AIRecommendation };
