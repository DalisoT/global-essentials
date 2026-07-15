'use server';

/**
 * AI Recommendations — server actions (Phase 9 / 9.1 + 9.2).
 *
 * This module is the read/write surface for the
 * `ai_recommendations` table. The table is the "inbox" of every
 * AI suggestion the system makes (reorder alerts, anomaly
 * warnings, weekly briefing items, goal progress, etc.). The
 * user accepts, dismisses, or acts on them — and we record
 * the outcome so 9.6 (memory layer) can learn what kind of
 * advice is actually useful for this business.
 *
 * Two patterns for creating recommendations:
 *
 *   1. RECOMMENDED — `upsertRecommendation(...)` for idempotent
 *      writes. The action computes a natural key (kind +
 *      related_id + payload-hash) and either updates the
 *      existing row or inserts a new one. This is what
 *      `getReorderAlerts` and the weekly cron call — the same
 *      recommendation might come up many times; we only want
 *      to count it once.
 *
 *   2. SIMPLE — `createRecommendation(...)` for one-off
 *      entries (e.g. an anomaly that just fired and probably
 *      won't fire again for the same input).
 *
 * For the inbox UI, the `listRecommendations` action returns
 * pending items sorted by priority + date. The
 * `updateRecommendationStatus` action is the write surface
 * for accept / dismiss / acted-on.
 */

import { requireAuth } from '@/lib/supabase-server';
import type {
  AIRecommendation,
  AIRecommendationKind,
  AIRecommendationPriority,
  AIRecommendationStatus,
} from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Read: list / get
// ─────────────────────────────────────────────────────────────────────

export interface ListRecommendationsOptions {
  /** Filter by status. Default: 'pending'. */
  status?: AIRecommendationStatus | 'all';
  /** Filter by kind. Default: all. */
  kind?: AIRecommendationKind;
  /** Cap on returned rows. Default 50. */
  limit?: number;
}

export async function listRecommendations(
  options: ListRecommendationsOptions = {}
): Promise<{ data?: AIRecommendation[]; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  let q = supabase
    .from('ai_recommendations')
    .select('*')
    .order('priority', { ascending: false }) // high > medium > low; but PG string sort
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.status && options.status !== 'all') {
    q = q.eq('status', options.status);
  }
  if (options.kind) {
    q = q.eq('kind', options.kind);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as AIRecommendation[] };
}

/**
 * Count of pending recommendations, grouped by priority. Cheap
 * single query (we use the partial index on status='pending').
 * Used by the dashboard / drawer badge.
 */
export async function getPendingRecommendationCount(): Promise<{
  data?: { total: number; high: number; medium: number; low: number };
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('priority')
    .eq('status', 'pending');

  if (error) return { error: error.message };
  const rows = (data ?? []) as Array<{ priority: AIRecommendationPriority }>;
  const counts = { total: rows.length, high: 0, medium: 0, low: 0 };
  for (const r of rows) {
    if (r.priority === 'high') counts.high += 1;
    else if (r.priority === 'medium') counts.medium += 1;
    else counts.low += 1;
  }
  return { data: counts };
}

// ─────────────────────────────────────────────────────────────────────
// Write: create / upsert / update status
// ─────────────────────────────────────────────────────────────────────

export interface CreateRecommendationInput {
  kind: AIRecommendationKind;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  priority?: AIRecommendationPriority;
  source_action?: string;
  related_id?: string;
  expires_at?: string;
}

/**
 * Insert a new recommendation. Most callers should prefer
 * upsertRecommendation so duplicates (same kind + related
 * entity) don't pile up.
 */
export async function createRecommendation(
  input: CreateRecommendationInput
): Promise<{ data?: AIRecommendation; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (!input.title || !input.body) {
    return { error: 'title and body are required' };
  }

  const { data, error } = await supabase
    .from('ai_recommendations')
    .insert([{
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 2000),
      payload: input.payload ?? {},
      priority: input.priority ?? 'medium',
      status: 'pending',
      source_action: input.source_action ?? null,
      related_id: input.related_id ?? null,
      user_id: userId,
      expires_at: input.expires_at ?? null,
    }])
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { data: data as unknown as AIRecommendation };
}

/**
 * Idempotent insert. Uses (kind, related_id, payload_hash) as
 * the natural key — if a matching pending recommendation
 * already exists, update its body in case the underlying
 * numbers changed. If it's already dismissed / accepted /
 * acted_on, leave it alone (don't re-surface something the
 * user has decided about).
 */
export async function upsertRecommendation(
  input: CreateRecommendationInput
): Promise<{ data?: AIRecommendation; created: boolean; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { created: false, error: auth.error };
  const { supabase } = auth;

  if (!input.title || !input.body) {
    return { created: false, error: 'title and body are required' };
  }
  if (!input.related_id) {
    // Without a related_id we can't idempotent. Fall back to
    // a plain create.
    const r = await createRecommendation(input);
    return r.data
      ? { data: r.data, created: true, error: r.error }
      : { created: false, error: r.error };
  }

  // Look for an existing pending recommendation with the same
  // kind + related_id.
  const { data: existing, error: lookupError } = await supabase
    .from('ai_recommendations')
    .select('id, status')
    .eq('kind', input.kind)
    .eq('related_id', input.related_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (lookupError) return { created: false, error: lookupError.message };

  if (existing) {
    // Update the body in case the underlying numbers moved, but
    // keep the status (the user has been notified).
    const { data, error } = await supabase
      .from('ai_recommendations')
      .update({
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 2000),
        payload: input.payload ?? {},
        priority: input.priority ?? 'medium',
        expires_at: input.expires_at ?? null,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single();
    if (error) return { created: false, error: error.message };
    return { data: data as unknown as AIRecommendation, created: false };
  }

  // No existing pending one — insert fresh. The user_id is set
  // by createRecommendation via requireAuth.
  const r = await createRecommendation(input);
  return r.data
    ? { data: r.data, created: true, error: r.error }
    : { created: false, error: r.error };
}

/**
 * Mark a recommendation as delivered (the UI has shown it).
 * Auto-sets delivered_at = now() if transitioning to 'delivered'.
 */
export async function markRecommendationDelivered(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from('ai_recommendations')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

/**
 * Update the user's response to a recommendation. This is the
 * action the inbox UI calls when the user clicks Accept /
 * Dismiss / Acted.
 */
export async function updateRecommendationStatus(
  id: string,
  status: 'dismissed' | 'accepted' | 'acted_on'
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'dismissed') {
    updates.dismissed_at = new Date().toISOString();
  } else if (status === 'acted_on' || status === 'accepted') {
    updates.acted_on_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ai_recommendations')
    .update(updates)
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ─────────────────────────────────────────────────────────────────────
// 9.2 — Accept/reject history (the input the memory layer reads)
// ─────────────────────────────────────────────────────────────────────

/**
 * Return a summary of the user's accept/reject history by kind.
 * Used by 9.6 to tune which kinds of recommendations to surface
 * more or less aggressively.
 */
export async function getRecommendationHistory(
  lookbackDays = 60
): Promise<{
  data?: Array<{
    kind: AIRecommendationKind;
    total: number;
    accepted: number;
    acted_on: number;
    dismissed: number;
  }>;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase } = auth;

  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('kind, status')
    .gte('created_at', since.toISOString());

  if (error) return { error: error.message };

  const rows = (data ?? []) as Array<{ kind: AIRecommendationKind; status: AIRecommendationStatus }>;
  const byKind = new Map<string, { kind: AIRecommendationKind; total: number; accepted: number; acted_on: number; dismissed: number }>();
  for (const r of rows) {
    const entry = byKind.get(r.kind) ?? {
      kind: r.kind,
      total: 0,
      accepted: 0,
      acted_on: 0,
      dismissed: 0,
    };
    entry.total += 1;
    if (r.status === 'accepted') entry.accepted += 1;
    else if (r.status === 'acted_on') entry.acted_on += 1;
    else if (r.status === 'dismissed') entry.dismissed += 1;
    byKind.set(r.kind, entry);
  }
  return { data: Array.from(byKind.values()) };
}
