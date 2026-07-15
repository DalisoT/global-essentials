'use server';

/**
 * Anomaly Detection (Phase 9 / 9.4).
 *
 * Scans the last 7 days of revenue and expenses and flags any
 * day that is statistically unusual compared to a 30-day
 * baseline (same day-of-week, so Sundays aren't flagged just
 * because the shop is closed on Sundays).
 *
 * The signal we use is robust: median + IQR over the trailing
 * 30 days, then flag if a value falls outside
 * [Q1 - 1.5 * IQR, Q3 + 1.5 * IQR] (the standard boxplot rule).
 * This avoids being thrown off by a single mega-sale in the
 * baseline period.
 *
 * Two categories of anomaly:
 *
 *   REVENUE
 *     - "low"  : a day with revenue < Q1 - 1.5 * IQR  (or 0
 *                 on a typically-busy day)
 *     - "high" : a day with revenue > Q3 + 1.5 * IQR
 *
 *   EXPENSE  (per category, per day)
 *     - "high" : a day in a category with spend > Q3 + 1.5 * IQR
 *
 * Each anomaly is persisted as a `kind='anomaly'` row in
 * `ai_recommendations`. Idempotent on (kind, related_id=date)
 * so a re-run on the same day just refreshes the body in case
 * the numbers moved.
 *
 * Cron: this action is called by /api/cron/detect-anomalies
 * nightly at the same time as the forecast regen (so the
 * inbox has fresh anomalies when the user opens the dashboard
 * in the morning).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { getMemorySnapshot } from '@/lib/ai/memory';
import type { AIRecommendation } from '@/lib/supabase-types';

const BASELINE_DAYS = 30;
const SCAN_DAYS = 7;
/** Boxplot rule. Days outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR] are outliers. */
const IQR_K = 1.5;
const MIN_BASELINE_POINTS = 4; // need at least 4 same-day-of-week samples

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

/** Day of week (0=Sun, 1=Mon, ..., 6=Sat) in Africa/Lusaka for a YYYY-MM-DD. */
function dayOfWeekLocal(dateStr: string): number {
  // Parse the date in Lusaka then ask for weekday.
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  // Convert to Lusaka wall time to find weekday there.
  const lusakaMs = utc.getTime() + (2 * 60 * 60 * 1000); // UTC+2, no DST
  const lusaka = new Date(lusakaMs);
  return lusaka.getUTCDay();
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

// ─────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────

/**
 * Quantile of a numeric array. Linear interpolation between
 * order statistics, type 7 (R's default). Stable on tiny arrays.
 */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

interface BoxStats {
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  count: number;
}

function boxStats(values: number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  return {
    median,
    q1,
    q3,
    iqr,
    lowerFence: q1 - IQR_K * iqr,
    upperFence: q3 + IQR_K * iqr,
    count: sorted.length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Anomaly model
// ─────────────────────────────────────────────────────────────────────

interface Anomaly {
  /** YYYY-MM-DD. Used as the natural key. */
  date: string;
  /** 'revenue_low' | 'revenue_high' | 'expense_high' */
  kind: 'revenue_low' | 'revenue_high' | 'expense_high';
  /** Short headline (≤ 8 words). */
  title: string;
  /** 1-2 sentence body, plain prose. */
  body: string;
  /** 'low' | 'medium' | 'high'. Drives inbox priority. */
  priority: 'low' | 'medium' | 'high';
  /** Structured detail for the payload column. */
  payload: {
    date: string;
    anomaly_type: 'revenue_low' | 'revenue_high' | 'expense_high';
    observed: number;
    baseline_median: number;
    deviation_pct: number; // (observed - median) / median * 100
    category?: string;
  };
}

const fmtK = (n: number) =>
  `K${Math.round(n).toLocaleString('en-US')}`;

/** Format a deviation like "+82%" or "-43%". */
const fmtPct = (pct: number) =>
  `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;

/**
 * Compute anomalies from the last SCAN_DAYS of data, against a
 * SCAN_DAYS-thick baseline of the previous BASELINE_DAYS. We
 * group by day-of-week so a closed-Sunday doesn't get flagged.
 */
async function computeAnomalies(
  supabase: SupabaseClient
): Promise<Anomaly[]> {
  const today = localDateString();
  const scanStart = addDays(today, -SCAN_DAYS); // 7 days ago
  const baselineEnd = addDays(scanStart, -1);   // day before scan
  const baselineStart = addDays(baselineEnd, -BASELINE_DAYS + 1);

  // ── Daily revenue (paid sales) for the entire window
  //    (baseline + scan).
  const { data: salesRows } = await supabase
    .from('sales')
    .select('total_amount, created_at, payment_status')
    .eq('payment_status', 'paid')
    .gte('created_at', `${baselineStart}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  // ── Daily expenses per category, same window.
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('amount, category, created_at')
    .gte('created_at', `${baselineStart}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  // Build daily revenue map: date -> total
  const revenueByDate = new Map<string, number>();
  for (const s of (salesRows ?? []) as Array<{
    total_amount: number;
    created_at: string;
  }>) {
    const day = (s.created_at ?? '').slice(0, 10);
    if (!day) continue;
    revenueByDate.set(day, (revenueByDate.get(day) ?? 0) + (s.total_amount ?? 0));
  }

  // Build daily expense-by-category map: date -> category -> total
  const expenseByDateAndCategory = new Map<string, Map<string, number>>();
  for (const e of (expenseRows ?? []) as Array<{
    amount: number;
    category: string;
    created_at: string;
  }>) {
    const day = (e.created_at ?? '').slice(0, 10);
    if (!day) continue;
    const cat = e.category || 'Uncategorised';
    const dayMap = expenseByDateAndCategory.get(day) ?? new Map();
    dayMap.set(cat, (dayMap.get(cat) ?? 0) + (e.amount ?? 0));
    expenseByDateAndCategory.set(day, dayMap);
  }

  // ── Build baselines (grouped by day-of-week)
  // For each day-of-week, collect all the revenue values from
  // the baseline period. That gives us, e.g., "all the
  // previous 4 Sundays' revenue".
  const revenueByDow = new Map<number, number[]>();
  for (let i = 0; i < BASELINE_DAYS; i++) {
    const day = addDays(baselineStart, i);
    const dow = dayOfWeekLocal(day);
    const rev = revenueByDate.get(day) ?? 0;
    const arr = revenueByDow.get(dow) ?? [];
    arr.push(rev);
    revenueByDow.set(dow, arr);
  }

  // Same for expenses: (dow, category) -> values[]
  const expenseByDowAndCategory = new Map<number, Map<string, number[]>>();
  for (let i = 0; i < BASELINE_DAYS; i++) {
    const day = addDays(baselineStart, i);
    const dow = dayOfWeekLocal(day);
    const dayMap = expenseByDateAndCategory.get(day) ?? new Map<string, number>();
    const dowMap = expenseByDowAndCategory.get(dow) ?? new Map<string, number[]>();
    for (const [cat, amount] of Array.from(dayMap.entries())) {
      const arr = dowMap.get(cat) ?? [];
      arr.push(amount);
      dowMap.set(cat, arr);
    }
    expenseByDowAndCategory.set(dow, dowMap);
  }

  const anomalies: Anomaly[] = [];

  // ── Scan the last SCAN_DAYS for revenue anomalies
  for (let i = 0; i < SCAN_DAYS; i++) {
    const day = addDays(scanStart, i);
    const dow = dayOfWeekLocal(day);
    const baseline = (revenueByDow.get(dow) ?? []).filter((v) => v > 0);
    if (baseline.length < MIN_BASELINE_POINTS) continue;
    const stats = boxStats(baseline);
    const observed = revenueByDate.get(day) ?? 0;
    const deviationPct =
      stats.median > 0
        ? ((observed - stats.median) / stats.median) * 100
        : 0;

    if (observed < stats.lowerFence) {
      const priority: Anomaly['priority'] = deviationPct < -70 ? 'high' : 'medium';
      anomalies.push({
        date: day,
        kind: 'revenue_low',
        title: `Low revenue on ${prettyDow(dow)}`,
        body:
          `You made ${fmtK(observed)} on ${prettyDow(dow)} ${day}, ` +
          `well below your typical ${fmtK(stats.median)} for that day ` +
          `(${fmtPct(deviationPct)}). ${
            observed === 0
              ? 'No sales at all — worth checking what happened.'
              : 'Worth a quick look at what was different.'
          }`,
        priority,
        payload: {
          date: day,
          anomaly_type: 'revenue_low',
          observed,
          baseline_median: Math.round(stats.median),
          deviation_pct: Math.round(deviationPct),
        },
      });
    } else if (observed > stats.upperFence && observed > 0) {
      anomalies.push({
        date: day,
        kind: 'revenue_high',
        title: `Strong revenue on ${prettyDow(dow)}`,
        body:
          `You made ${fmtK(observed)} on ${prettyDow(dow)} ${day}, ` +
          `well above your typical ${fmtK(stats.median)} for that day ` +
          `(${fmtPct(deviationPct)}). If this is a pattern you can ` +
          `lean into, consider stocking up for the next one.`,
        priority: 'low',
        payload: {
          date: day,
          anomaly_type: 'revenue_high',
          observed,
          baseline_median: Math.round(stats.median),
          deviation_pct: Math.round(deviationPct),
        },
      });
    }
  }

  // ── Scan the last SCAN_DAYS for expense anomalies per category
  for (let i = 0; i < SCAN_DAYS; i++) {
    const day = addDays(scanStart, i);
    const dow = dayOfWeekLocal(day);
    const dayMap = expenseByDateAndCategory.get(day) ?? new Map<string, number>();
    const dowMap = expenseByDowAndCategory.get(dow) ?? new Map<string, number[]>();
    for (const [cat, observed] of Array.from(dayMap.entries())) {
      const baseline = (dowMap.get(cat) ?? []).filter((v) => v > 0);
      if (baseline.length < MIN_BASELINE_POINTS) continue;
      const stats = boxStats(baseline);
      if (observed > stats.upperFence) {
        const deviationPct =
          stats.median > 0
            ? ((observed - stats.median) / stats.median) * 100
            : 0;
        const priority: Anomaly['priority'] = deviationPct > 200 ? 'high' : 'medium';
        anomalies.push({
          date: day,
          kind: 'expense_high',
          title: `Unusual spend: ${cat}`,
          body:
            `You spent ${fmtK(observed)} on ${cat} on ${day}, ` +
            `vs your typical ${fmtK(stats.median)} on ${prettyDow(dow)} ` +
            `(${fmtPct(deviationPct)}). Worth checking whether this ` +
            `was a one-off or a new recurring cost.`,
          priority,
          payload: {
            date: day,
            anomaly_type: 'expense_high',
            observed,
            baseline_median: Math.round(stats.median),
            deviation_pct: Math.round(deviationPct),
            category: cat,
          },
        });
      }
    }
  }

  return anomalies;
}

function prettyDow(dow: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
}

// ─────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────

async function persistAnomaly(
  supabase: SupabaseClient,
  a: Anomaly
): Promise<{ created: boolean; error?: string }> {
  // Natural key (kind, related_id=date, payload->>'category' when applicable).
  // The table has no partial unique index that fits, so we do an
  // explicit lookup. With cron running once a day, lookups
  // are cheap.
  const query = supabase
    .from('ai_recommendations')
    .select('id, status')
    .eq('kind', 'anomaly')
    .eq('related_id', a.date)
    .eq('status', 'pending');
  const { data: existing, error: lookupError } = await query.maybeSingle();
  if (lookupError) return { created: false, error: lookupError.message };

  if (existing) {
    // Update in case numbers moved, keep status.
    const { error } = await supabase
      .from('ai_recommendations')
      .update({
        title: a.title,
        body: a.body,
        payload: a.payload as unknown as Record<string, unknown>,
        priority: a.priority,
      })
      .eq('id', (existing as { id: string }).id);
    return { created: false, error: error?.message };
  }

  const { error } = await supabase
    .from('ai_recommendations')
    .insert([{
      kind: 'anomaly',
      title: a.title,
      body: a.body,
      payload: a.payload as unknown as Record<string, unknown>,
      priority: a.priority,
      status: 'pending',
      source_action: 'detectAnomalies',
      related_id: a.date,
    }]);
  return { created: !error, error: error?.message };
}

// ─────────────────────────────────────────────────────────────────────
// Public entry points
// ─────────────────────────────────────────────────────────────────────

export interface DetectAnomaliesResult {
  ok: boolean;
  scannedDays: number;
  detected: number;
  inserted: number;
  updated: number;
  message?: string;
}

export async function detectAnomalies(
  supabase: SupabaseClient
): Promise<DetectAnomaliesResult> {
  // 9.6 — load the user's engagement profile for 'anomaly' so
  // we can de-prioritise (or promote) rows based on history.
  const memory = await getMemorySnapshot();
  const memoryPriority = memory.priorityFor('anomaly');

  const anomalies = await computeAnomalies(supabase);
  let inserted = 0;
  let updated = 0;
  for (let a of anomalies) {
    // Blend: if the user has consistently ignored anomalies
    // (memoryPriority='low') and the heuristic isn't already
    // screaming 'high', demote to 'low' so the inbox doesn't
    // fill with noise. Conversely, if the user engages a
    // lot, promote 'medium' → 'high'.
    a = { ...a, priority: blendPriority(a.priority, memoryPriority) };
    const r = await persistAnomaly(supabase, a);
    if (r.error) {
      return {
        ok: false,
        scannedDays: SCAN_DAYS,
        detected: anomalies.length,
        inserted,
        updated,
        message: r.error,
      };
    }
    if (r.created) inserted += 1;
    else updated += 1;
  }
  return {
    ok: true,
    scannedDays: SCAN_DAYS,
    detected: anomalies.length,
    inserted,
    updated,
  };
}

const PRIORITY_ORDER: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};
function reversePriority(n: number): 'low' | 'medium' | 'high' {
  return n === 0 ? 'low' : n === 1 ? 'medium' : 'high';
}
/**
 * Blend the heuristic priority with the memory's hint.
 *   - If heuristic is 'high' we keep it (don't suppress real signals).
 *   - Otherwise we take the max of (heuristic, memoryHint) so the
 *     memory can promote, but only demote when the heuristic is
 *     already 'low' or 'medium' AND the memory says 'low'.
 * Effectively: memory is a soft ceiling when the user is
 * disengaged, and a soft floor when the user is engaged.
 */
function blendPriority(
  heuristic: 'low' | 'medium' | 'high',
  memory: 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
  if (heuristic === 'high') return 'high';
  const h = PRIORITY_ORDER[heuristic];
  const m = PRIORITY_ORDER[memory];
  // Take the higher of the two unless memory says 'low' AND
  // heuristic is 'medium' — then demote to 'low' (engagement
  // override).
  if (memory === 'low' && heuristic === 'medium') return 'low';
  return reversePriority(Math.max(h, m));
}

/**
 * Cron-friendly wrapper. Owns its own service-role client.
 */
export async function runAnomalyDetectionCron(): Promise<DetectAnomaliesResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      scannedDays: SCAN_DAYS,
      detected: 0,
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : 'Failed to create service-role client',
    };
  }
  return detectAnomalies(supabase);
}

// Reference AIRecommendation so the type is consumed — keeps
// the import warm for callers (the dashboard's anomaly panel,
// when we add it).
export type { AIRecommendation };
