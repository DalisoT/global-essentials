/**
 * Memory Layer (Phase 9 / 9.6).
 *
 * Reads the user's accept/reject history from
 * `ai_recommendations` and turns it into:
 *
 *   1. A per-kind engagement score (0..1, weighted
 *      `acted_on` higher than `accepted`, `dismissed`
 *      drags the score down).
 *   2. A short "USER PREFERENCES" prose block designed to be
 *      pasted into an LLM system prompt.
 *   3. A priority-hint map so actions can adjust their
 *      `priority` field before writing to the inbox
 *      (high-engagement kinds get promoted, low-engagement
 *      kinds get demoted, so the inbox stays useful and
 *      short).
 *
 * Cache: a per-process map keyed by the SQL result of
 * `getRecommendationHistory(60)`. The map resets on every
 * cold start. Within a single page render the same memory
 * is reused across multiple AI actions, so we don't pay
 * the DB roundtrip twice.
 *
 * For the v1, the history window is 60 days. We picked 60
 * because it's long enough to smooth out a single bad week
 * but short enough that the user's preferences from a year
 * ago don't dominate (a small shop's profile can change
 * meaningfully in 2 months).
 */

import { getRecommendationHistory } from '@/lib/actions/recommendations';
import type { AIRecommendationKind } from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface MemorySnapshot {
  /** Per-kind stats, including the engagement score and a label. */
  perKind: Array<{
    kind: AIRecommendationKind;
    total: number;
    accepted: number;
    acted_on: number;
    dismissed: number;
    /** 0..1. Higher = the user engages with this kind of advice. */
    score: number;
    /** 'high' | 'medium' | 'low' | 'none' (when no data). */
    label: 'high' | 'medium' | 'low' | 'none';
  }>;
  /** 'high' | 'medium' | 'low' (overall) — derived from the
   *  average engagement weighted by sample size. */
  overall: 'high' | 'medium' | 'low';
  /** Prose block ready to be embedded into a system prompt. */
  proseForPrompt: string;
  /** Lookup helper for priority adjustment. */
  priorityFor: (kind: AIRecommendationKind) => 'low' | 'medium' | 'high';
  /** When this snapshot was generated (ISO). */
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000;
let _cached: { at: number; data: MemorySnapshot } | null = null;

function isFresh(): boolean {
  return _cached !== null && Date.now() - _cached.at < TTL_MS;
}

/** Drop the cache. Test-only escape hatch; no production caller. */
export function clearMemoryCache() {
  _cached = null;
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Return the current memory snapshot. Cached for 5 minutes
 * per process. Safe to call from any server action.
 *
 * On any error (no history, DB down) we return a neutral
 * snapshot — the system stays useful, the user just doesn't
 * get a personalised experience yet.
 */
export async function getMemorySnapshot(): Promise<MemorySnapshot> {
  if (isFresh() && _cached) return _cached.data;

  let history: Awaited<ReturnType<typeof getRecommendationHistory>>['data'] = [];
  try {
    const res = await getRecommendationHistory(60);
    if (!res.error && res.data) history = res.data;
  } catch {
    // Swallow — neutral snapshot below.
  }

  const perKind = computePerKind(history);
  const overall = computeOverall(perKind);
  const proseForPrompt = renderProse(perKind, overall);
  const priorityFor = makePriorityFn(perKind);

  const snapshot: MemorySnapshot = {
    perKind,
    overall,
    proseForPrompt,
    priorityFor,
    generatedAt: new Date().toISOString(),
  };
  _cached = { at: Date.now(), data: snapshot };
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

interface KindStats {
  kind: AIRecommendationKind;
  total: number;
  accepted: number;
  acted_on: number;
  dismissed: number;
  score: number;
  label: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Engagement score per kind.
 *
 *   score = (acted_on * 1.0 + accepted * 0.6 − dismissed * 0.4) / total
 *
 * Result is clamped to [0, 1]. A score ≥ 0.5 is "high"
 * engagement, ≥ 0.2 is "medium", and below that is "low".
 * Kinds with zero data are labelled 'none' and treated as
 * neutral (they don't pull the score down, but they also
 * don't promote themselves).
 */
function computePerKind(
  history: NonNullable<Awaited<ReturnType<typeof getRecommendationHistory>>['data']>
): KindStats[] {
  const knownKinds: AIRecommendationKind[] = [
    'reorder_alert',
    'cashflow_warning',
    'anomaly',
    'weekly_briefing',
    'goal_progress',
    'forecast_alert',
    'custom',
  ];

  return knownKinds.map((kind) => {
    const row = history.find((h) => h.kind === kind);
    if (!row || row.total === 0) {
      return { kind, total: 0, accepted: 0, acted_on: 0, dismissed: 0, score: 0, label: 'none' };
    }
    const raw = (row.acted_on * 1.0 + row.accepted * 0.6 - row.dismissed * 0.4) / row.total;
    const score = Math.max(0, Math.min(1, raw));
    let label: KindStats['label'] = 'low';
    if (score >= 0.5) label = 'high';
    else if (score >= 0.2) label = 'medium';
    return {
      kind,
      total: row.total,
      accepted: row.accepted,
      acted_on: row.acted_on,
      dismissed: row.dismissed,
      score,
      label,
    };
  });
}

function computeOverall(perKind: KindStats[]): 'high' | 'medium' | 'low' {
  // Weight by total so kinds with 1 sample don't dominate.
  let weightedSum = 0;
  let weightTotal = 0;
  for (const k of perKind) {
    if (k.label === 'none') continue;
    const w = k.total;
    weightedSum += k.score * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return 'medium'; // no data → neutral
  const avg = weightedSum / weightTotal;
  if (avg >= 0.5) return 'high';
  if (avg >= 0.25) return 'medium';
  return 'low';
}

function renderProse(perKind: KindStats[], overall: 'high' | 'medium' | 'low'): string {
  const high = perKind.filter((k) => k.label === 'high');
  const low = perKind.filter((k) => k.label === 'low');

  const lines: string[] = [];

  if (overall === 'high') {
    lines.push('The owner is highly engaged with AI suggestions — keep them coming, and prefer the kinds they engage with most.');
  } else if (overall === 'low') {
    lines.push('The owner often dismisses AI suggestions. Be conservative: fewer recommendations, only the most material ones, with concrete numbers.');
  } else {
    lines.push('The owner is moderately engaged with AI suggestions. Mix concrete alerts with broader context.');
  }

  if (high.length > 0) {
    const examples = high.map((k) => KIND_DISPLAY[k.kind]).join(', ');
    lines.push(`They engage most with: ${examples}. Lean into these kinds.`);
  }
  if (low.length > 0) {
    const examples = low.map((k) => KIND_DISPLAY[k.kind]).join(', ');
    lines.push(`They rarely engage with: ${examples}. De-prioritise these unless the signal is unusually strong.`);
  }

  return lines.join(' ');
}

const KIND_DISPLAY: Record<AIRecommendationKind, string> = {
  reorder_alert: 'reorder alerts',
  cashflow_warning: 'cashflow warnings',
  anomaly: 'anomalies (unusual revenue or expense days)',
  weekly_briefing: 'weekly briefings',
  goal_progress: 'goal progress updates',
  forecast_alert: 'forecast alerts',
  custom: 'custom insights',
};

function makePriorityFn(
  perKind: KindStats[]
): (kind: AIRecommendationKind) => 'low' | 'medium' | 'high' {
  const map = new Map(perKind.map((k) => [k.kind, k.label]));
  return (kind) => {
    const label = map.get(kind) ?? 'none';
    if (label === 'high') return 'high';
    if (label === 'low') return 'low';
    return 'medium';
  };
}

// ─────────────────────────────────────────────────────────────────────
// Convenience: ready-to-append block for any system prompt
// ─────────────────────────────────────────────────────────────────────

/**
 * Render a `USER PREFERENCES:` block that callers can append
 * to their system prompt. Returns an empty string if the
 * memory is in a "no data" state.
 */
export async function buildMemoryPromptBlock(): Promise<string> {
  const snap = await getMemorySnapshot();
  if (snap.perKind.every((k) => k.label === 'none')) return '';
  return `\n\nUSER PREFERENCES (60-day engagement history):\n${snap.proseForPrompt}`;
}
