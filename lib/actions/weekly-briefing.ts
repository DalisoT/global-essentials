'use server';

/**
 * Weekly Briefing (Phase 9 / 9.3).
 *
 * Generates a 3-5 section executive summary of the past 7 days for
 * the shop owner. The summary is persisted as a single
 * `ai_recommendations` row with `kind='weekly_briefing'` so it
 * shows up in the inbox (and, in v2, will be emailed).
 *
 * Idempotency: the natural key is (kind='weekly_briefing',
 * related_id=<weekStartISO>). If a pending briefing for the same
 * week already exists, we update it; if it's been dismissed /
 * accepted, we don't re-surface it (the user has already made
 * a decision about it).
 *
 * Called by:
 *   - The Vercel cron at /api/cron/weekly-briefing
 *     (Sunday 08:00 Africa/Lusaka, see vercel.json).
 *   - The dashboard's "Generate now" button (not yet exposed
 *     in v1, but the action supports it).
 *
 * In v1 the briefing lives only in the inbox. Email is
 * out of scope — we'll wire that up once we have a
 * transactional provider. v2 will likely also push to the
 * mobile push channel (usePushNotifications) for the same
 * row, gated on the same recommendation flow.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import groq from '@/lib/groq';
import { weeklyBriefing } from '@/lib/ai/prompts';
import { buildMemoryPromptBlock } from '@/lib/ai/memory';
import { createServiceRoleClient } from '@/lib/supabase-server';
import type { AIRecommendation } from '@/lib/supabase-types';

export interface WeeklyBriefingSection {
  headline: string;
  body: string;
}

export interface WeeklyBriefingJSON {
  summary: string;
  highlight: string;
  sections: WeeklyBriefingSection[];
}

// ─────────────────────────────────────────────────────────────────────
// Time helpers (Africa/Lusaka, no DST)
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
  // Use a UTC date formatter so we don't pick up timezone drift.
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Most recent Sunday 00:00 Africa/Lusaka. The "start of this
 * briefing week" — briefings summarise the 7 days that just
 * ended. Returns the YYYY-MM-DD of the Sunday that started the
 * week that just ended.
 *
 * Example: if today is Wed, the most recent Sunday is the one
 * 4 days ago, so the week we summarise is Mon..Sun (which is
 * 4..10 days ago).
 */
function startOfThisWeek(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const todayStr = localDateString(today);
  // getUTCDay: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dow = today.getUTCDay();
  // The most recent Sunday (could be today) is `dow` days back.
  const sunday = addDays(todayStr, -dow);
  // The week we summarise is Mon..Sun, i.e. 6..0 days before
  // that Sunday. So 6 days before sunday = the Monday of the
  // week we just finished. Wait — that's wrong. If today is Wed
  // (dow=3), sunday is 3 days back. The week we summarise
  // is Mon..Sun = 4..10 days back. So monday = sunday - 6.
  const weekStart = addDays(sunday, -6);
  const weekEnd = sunday;
  return { weekStart, weekEnd };
}

// ─────────────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────────────

interface Snapshot {
  weekStartISO: string;
  weekEndISO: string;
  revenueThisWeek: number;
  salesCountThisWeek: number;
  revenueLastWeek: number;
  expensesThisWeek: number;
  expensesLastWeek: number;
  topProducts: Array<{ name: string; revenue: number; unitsSold: number }>;
  topExpenseCategories: Array<{ category: string; amount: number }>;
  lowStockNames: string[];
  upcomingDuesTotal: number;
  upcomingDuesCount: number;
  cashflowForecast30d: number;
  pendingRecsCount: number;
  highPriorityRecsCount: number;
}

async function buildSnapshot(
  supabase: SupabaseClient,
  weekStart: string,
  weekEnd: string
): Promise<Snapshot> {
  const lastWeekStart = addDays(weekStart, -7);

  // ── This week: paid sales
  const { data: thisWeekSales } = await supabase
    .from('sales')
    .select('id, total_amount, product_id, quantity, product:products(name)')
    .eq('payment_status', 'paid')
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59.999`);

  // ── Last week: paid sales
  const { data: lastWeekSales } = await supabase
    .from('sales')
    .select('id, total_amount')
    .eq('payment_status', 'paid')
    .gte('created_at', `${lastWeekStart}T00:00:00`)
    .lte('created_at', `${addDays(weekStart, -1)}T23:59:59.999`);

  // ── This week: expenses
  const { data: thisWeekExpenses } = await supabase
    .from('expenses')
    .select('id, amount, category')
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59.999`);

  // ── Last week: expenses
  const { data: lastWeekExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .gte('created_at', `${lastWeekStart}T00:00:00`)
    .lte('created_at', `${addDays(weekStart, -1)}T23:59:59.999`);

  // ── Low stock (current)
  const { data: lowStock } = await supabase
    .from('products')
    .select('id, name, stock_level')
    .is('deleted_at', null)
    .lte('stock_level', 5)
    .order('stock_level', { ascending: true })
    .limit(10);

  // ── Upcoming dues (next 14 days)
  const horizon = addDays(weekEnd, 14);
  const { data: upcomingDues } = await supabase
    .from('installments')
    .select('amount_due')
    .eq('is_paid', false)
    .gte('due_date', weekEnd)
    .lte('due_date', horizon);

  // ── 30-day cashflow forecast total (compute inline; cheap)
  const { data: dashboardStats } = await supabase
    .from('sales')
    .select('total_amount, payment_status');
  const { data: allExpenses } = await supabase
    .from('expenses')
    .select('amount');
  const groundTruth =
    (dashboardStats ?? [])
      .filter((s) => s.payment_status === 'paid')
      .reduce((sum, s) => sum + (s.total_amount ?? 0), 0) -
    (allExpenses ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);

  // Upcoming inflows in next 30 days
  const next30 = addDays(weekEnd, 30);
  const { data: upcomingInstallments } = await supabase
    .from('installments')
    .select('amount_due')
    .eq('is_paid', false)
    .gte('due_date', weekEnd)
    .lte('due_date', next30);

  // Upcoming expenses in next 30 days (rough: avg daily this
  // week × 30). Same data shape either way.
  const avgDailyExpense = (thisWeekExpenses ?? []).length > 0
    ? (thisWeekExpenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0) / 7
    : 0;

  const inflows30 = (upcomingInstallments ?? []).reduce(
    (s, i) => s + (i.amount_due ?? 0),
    0
  );
  const outflows30 = avgDailyExpense * 30;
  const cashflowForecast30d = Math.round(groundTruth + inflows30 - outflows30);

  // ── Pending AI recommendations
  const { data: pendingRecs } = await supabase
    .from('ai_recommendations')
    .select('id, priority')
    .eq('status', 'pending');

  // ── Build top products (by revenue) this week
  const productAgg = new Map<string, { name: string; revenue: number; unitsSold: number }>();
  for (const s of (thisWeekSales ?? []) as Array<{
    total_amount: number;
    quantity: number | null;
    product: { name: string } | { name: string }[] | null;
  }>) {
    const productRel = Array.isArray(s.product) ? s.product[0] : s.product;
    const name = productRel?.name ?? 'Unknown';
    const entry = productAgg.get(name) ?? { name, revenue: 0, unitsSold: 0 };
    entry.revenue += s.total_amount ?? 0;
    entry.unitsSold += s.quantity ?? 1;
    productAgg.set(name, entry);
  }
  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Build top expense categories
  const categoryAgg = new Map<string, number>();
  for (const e of (thisWeekExpenses ?? []) as Array<{ amount: number; category: string }>) {
    categoryAgg.set(e.category, (categoryAgg.get(e.category) ?? 0) + (e.amount ?? 0));
  }
  const topExpenseCategories = Array.from(categoryAgg.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    weekStartISO: weekStart,
    weekEndISO: weekEnd,
    revenueThisWeek: (thisWeekSales ?? []).reduce(
      (s, x) => s + (x.total_amount ?? 0),
      0
    ),
    salesCountThisWeek: (thisWeekSales ?? []).length,
    revenueLastWeek: (lastWeekSales ?? []).reduce(
      (s, x) => s + (x.total_amount ?? 0),
      0
    ),
    expensesThisWeek: (thisWeekExpenses ?? []).reduce(
      (s, x) => s + (x.amount ?? 0),
      0
    ),
    expensesLastWeek: (lastWeekExpenses ?? []).reduce(
      (s, x) => s + (x.amount ?? 0),
      0
    ),
    topProducts,
    topExpenseCategories,
    lowStockNames: (lowStock ?? []).map((p) => p.name).slice(0, 5),
    upcomingDuesTotal: (upcomingDues ?? []).reduce(
      (s, i) => s + (i.amount_due ?? 0),
      0
    ),
    upcomingDuesCount: (upcomingDues ?? []).length,
    cashflowForecast30d,
    pendingRecsCount: (pendingRecs ?? []).length,
    highPriorityRecsCount: (pendingRecs ?? []).filter(
      (r) => r.priority === 'high'
    ).length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Groq call
// ─────────────────────────────────────────────────────────────────────

async function callBriefingModel(
  snapshot: Snapshot
): Promise<WeeklyBriefingJSON | null> {
  const userPrompt = weeklyBriefing.buildUserMessage({
    weekStartISO: snapshot.weekStartISO,
    weekEndISO: snapshot.weekEndISO,
    revenueThisWeek: snapshot.revenueThisWeek,
    salesCountThisWeek: snapshot.salesCountThisWeek,
    revenueLastWeek: snapshot.revenueLastWeek,
    expensesThisWeek: snapshot.expensesThisWeek,
    expensesLastWeek: snapshot.expensesLastWeek,
    topProducts: snapshot.topProducts,
    topExpenseCategories: snapshot.topExpenseCategories,
    lowStockNames: snapshot.lowStockNames,
    upcomingDuesTotal: snapshot.upcomingDuesTotal,
    upcomingDuesCount: snapshot.upcomingDuesCount,
    cashflowForecast30d: snapshot.cashflowForecast30d,
    pendingRecsCount: snapshot.pendingRecsCount,
    highPriorityRecsCount: snapshot.highPriorityRecsCount,
  });

  // 9.6 — inject the user's 60-day engagement profile into
  // the system prompt. If there's no history yet, this is a
  // no-op.
  const memoryBlock = await buildMemoryPromptBlock();
  const systemPrompt = weeklyBriefing.system.replace('{{MEMORY}}', memoryBlock);

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: weeklyBriefing.meta.model,
      temperature: weeklyBriefing.meta.temperature,
      max_tokens: weeklyBriefing.meta.maxTokens,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    return parseBriefing(content);
  } catch (err) {
    console.warn('[WeeklyBriefing] Groq call failed:', err);
    return null;
  }
}

function parseBriefing(content: string): WeeklyBriefingJSON | null {
  const cleaned = content
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('summary' in parsed) ||
    !('highlight' in parsed) ||
    !('sections' in parsed) ||
    !Array.isArray((parsed as { sections: unknown }).sections)
  ) {
    return null;
  }

  const obj = parsed as {
    summary: unknown;
    highlight: unknown;
    sections: unknown;
  };

  const sections: WeeklyBriefingSection[] = [];
  for (const s of obj.sections as unknown[]) {
    if (
      s &&
      typeof s === 'object' &&
      'headline' in s &&
      'body' in s &&
      typeof (s as { headline: unknown }).headline === 'string' &&
      typeof (s as { body: unknown }).body === 'string'
    ) {
      sections.push({
        headline: ((s as { headline: string }).headline || '').slice(0, 80).trim(),
        body: ((s as { body: string }).body || '').slice(0, 320).trim(),
      });
    }
    if (sections.length >= 5) break;
  }

  if (sections.length < 3) return null;

  return {
    summary: (typeof obj.summary === 'string' ? obj.summary : '').slice(0, 120).trim(),
    highlight: (typeof obj.highlight === 'string' ? obj.highlight : '').slice(0, 200).trim(),
    sections,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────

export interface GenerateWeeklyBriefingResult {
  ok: boolean;
  /** The persisted recommendation row, if successful. */
  recommendation?: AIRecommendation;
  /** Free-form error or status text. */
  message?: string;
  /** The structured briefing the model returned, if any. */
  briefing?: WeeklyBriefingJSON;
}

/**
 * Build a briefing, run it through the model, and persist it as a
 * single ai_recommendations row. Idempotent on (kind,
 * related_id=weekStartISO).
 *
 * `supabase` is required because the cron uses the service-role
 * client (we bypass RLS for the upsert). For the dashboard's
 * "Generate now" button, callers should pass the user's own
 * client (so they can't write briefings on behalf of other
 * users in a multi-tenant future).
 *
 * If the model fails or returns garbage, we return ok:false with
 * a message — we do NOT persist a low-quality briefing.
 */
export async function generateWeeklyBriefing(
  supabase: SupabaseClient
): Promise<GenerateWeeklyBriefingResult> {
  const { weekStart, weekEnd } = startOfThisWeek();
  const snapshot = await buildSnapshot(supabase, weekStart, weekEnd);
  const briefing = await callBriefingModel(snapshot);

  if (!briefing) {
    return { ok: false, message: 'Model returned no usable briefing' };
  }

  // Title = the model's summary line. Body = highlight + the
  // 3-5 sections, joined. Payload keeps the structured data
  // for future UI (e.g. a "Sections" expansion in the inbox
  // card, or an email template).
  const title = briefing.summary || 'Your weekly briefing is ready';
  const body = [
    briefing.highlight,
    '',
    ...briefing.sections.map((s) => `${s.headline}: ${s.body}`),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);

  // We can't use the user-id-bound `upsertRecommendation` here
  // because we're using the service-role client. Manually
  // upsert instead, using (kind, related_id) as the natural
  // key — matching the recommendation's own action.

  // 1) Look for an existing pending briefing for this week.
  const { data: existing } = await supabase
    .from('ai_recommendations')
    .select('id, status')
    .eq('kind', 'weekly_briefing')
    .eq('related_id', weekStart)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    // Update the body in case the numbers shifted, but keep the
    // user-visible status (they've seen it).
    const { data, error } = await supabase
      .from('ai_recommendations')
      .update({
        title,
        body,
        payload: {
          week_start: weekStart,
          week_end: weekEnd,
          highlight: briefing.highlight,
          sections: briefing.sections,
          snapshot: {
            revenue_this_week: snapshot.revenueThisWeek,
            revenue_last_week: snapshot.revenueLastWeek,
            expenses_this_week: snapshot.expensesThisWeek,
            expenses_last_week: snapshot.expensesLastWeek,
            cashflow_forecast_30d: snapshot.cashflowForecast30d,
          },
        } as Record<string, unknown>,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, recommendation: data as unknown as AIRecommendation, briefing };
  }

  // 2) No existing pending one — insert fresh. If the user
  // dismissed/accepted last week's, those rows still exist
  // (related_id=lastWeekStart) but won't match the query above.
  const { data, error } = await supabase
    .from('ai_recommendations')
    .insert([{
      kind: 'weekly_briefing',
      title,
      body,
      payload: {
        week_start: weekStart,
        week_end: weekEnd,
        highlight: briefing.highlight,
        sections: briefing.sections,
        snapshot: {
          revenue_this_week: snapshot.revenueThisWeek,
          revenue_last_week: snapshot.revenueLastWeek,
          expenses_this_week: snapshot.expensesThisWeek,
          expenses_last_week: snapshot.expensesLastWeek,
          cashflow_forecast_30d: snapshot.cashflowForecast30d,
        },
      },
      priority: 'medium',
      status: 'pending',
      source_action: 'generateWeeklyBriefing',
      related_id: weekStart,
    }])
    .select('*')
    .single();

  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    recommendation: data as unknown as AIRecommendation,
    briefing,
  };
}

/**
 * Convenience wrapper for the cron route. Creates its own
 * service-role client, runs the briefing, returns the result.
 * Always returns a result (never throws) so the cron logs are
 * consistent.
 */
export async function runWeeklyBriefingCron(): Promise<GenerateWeeklyBriefingResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Failed to create service-role client',
    };
  }
  return generateWeeklyBriefing(supabase);
}
