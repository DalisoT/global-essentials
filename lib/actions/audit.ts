'use server';

import { requireAdmin } from '@/lib/supabase-server';
import type { AuditLog, AuditLogWithActor } from '@/lib/supabase-types';

/**
 * Audit log viewer (F10).
 *
 * The `audit_log` table is appended to by Phase 1's `postJournal` and any other
 * domain action that wants a paper trail. This file exposes the read API for
 * the in-app viewer at `/(pos)/audit/`.
 *
 * Every export is admin-gated via `requireAdmin()` — non-admins get a 403-ish
 * error string back. We deliberately do the gate *inside* each exported action
 * (not in middleware) so the same module can be reused later for non-admin
 * read-only views (e.g. "my activity") without restructuring.
 */

export interface AuditLogFilters {
  /** Exact match on `action` (e.g. 'journal.post'). */
  action?: string;
  /** Exact match on `entity_type` (e.g. 'journal_entry', 'sale'). */
  entityType?: string;
  /** Exact match on `user_id` — the actor's auth.users id. */
  userId?: string;
  /** ISO date (yyyy-mm-dd). Inclusive lower bound on `created_at`. */
  dateFrom?: string;
  /** ISO date (yyyy-mm-dd). Inclusive upper bound on `created_at`. */
  dateTo?: string;
  /** Free-text search across `action` and a few denormalized metadata fields. */
  search?: string;
}

export interface AuditLogPage {
  data: AuditLogWithActor[];
  count: number;
  error?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Fetch a page of audit log rows joined with the actor's profile (full_name, role).
 * Supports filtering + pagination. Returns `{ data, count, error? }` to match
 * the convention used by the rest of `lib/actions/`.
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  options: { limit?: number; offset?: number } = {}
): Promise<AuditLogPage> {
  const auth = await requireAdmin();
  if ('error' in auth) return { data: [], count: 0, error: auth.error };
  const { supabase } = auth;

  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, options.offset ?? 0);

  let query = supabase
    .from('audit_log')
    .select(
      `
      id, user_id, action, entity_type, entity_id, metadata, created_at,
      actor:profiles ( id, full_name, role )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  }
  if (filters.dateTo) {
    // Inclusive end-of-day so dateTo=2026-07-14 captures rows written on the 14th.
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  }

  // Free-text: postgREST `or` is the cheapest way to search `action` only.
  // Metadata is JSONB so we'd need a separate rpc for full-text on it; for
  // v1 we keep it scoped to `action` and entity_id, which covers 90% of
  // "find that one row" cases.
  if (filters.search) {
    const sanitized = filters.search.replace(/[%_]/g, '').trim();
    if (sanitized) {
      query = query.or(`action.ilike.%${sanitized}%,entity_id.ilike.%${sanitized}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) return { data: [], count: 0, error: error.message };

  // The foreign-key join comes back as `actor` (object, since it's a single
  // profile). Normalize nulls so the UI can render defensively.
  const rows = (data ?? []).map((row) => {
    const r = row as unknown as AuditLogWithActor;
    return {
      ...r,
      actor: r.actor ?? null,
    };
  });

  return { data: rows, count: count ?? rows.length };
}

/**
 * Distinct values for the filter dropdowns. Capped at 50 each to keep the
 * response small even after years of audit history.
 */
export async function getAuditLogFacets(): Promise<{
  actions: string[];
  entityTypes: string[];
  error?: string;
}> {
  const auth = await requireAdmin();
  if ('error' in auth) return { actions: [], entityTypes: [], error: auth.error };
  const { supabase } = auth;

  // PostgREST doesn't have a native `distinct` projection for arbitrary
  // columns, so we pull a bounded slice of both columns and dedupe in JS.
  // The `audit_log` table is append-only and will grow large; for v1 the
  // 500-row cap is plenty since facets are categorical. Phase 7 can swap
  // in an RPC if it ever becomes slow.
  const [{ data: actionRows, error: actionErr }, { data: entityRows, error: entityErr }] =
    await Promise.all([
      supabase.from('audit_log').select('action').order('created_at', { ascending: false }).limit(500),
      supabase.from('audit_log').select('entity_type').order('created_at', { ascending: false }).limit(500),
    ]);

  if (actionErr || entityErr) {
    return {
      actions: [],
      entityTypes: [],
      error: actionErr?.message || entityErr?.message,
    };
  }

  const actions = Array.from(
    new Set((actionRows ?? []).map((r) => (r as { action: string }).action).filter(Boolean))
  ).sort();
  const entityTypes = Array.from(
    new Set(
      (entityRows ?? [])
        .map((r) => (r as { entity_type: string | null }).entity_type)
        .filter((v): v is string => Boolean(v))
    )
  ).sort();

  return { actions, entityTypes };
}

/**
 * Quick aggregate counts for the page header chips (today / this week / total).
 * Runs three small queries in parallel.
 */
export async function getAuditLogStats(): Promise<{
  total: number;
  today: number;
  thisWeek: number;
  error?: string;
}> {
  const auth = await requireAdmin();
  if ('error' in auth) return { total: 0, today: 0, thisWeek: 0, error: auth.error };
  const { supabase } = auth;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfWeekIso = startOfWeek.toISOString();

  const [totalRes, todayRes, weekRes] = await Promise.all([
    supabase.from('audit_log').select('id', { count: 'exact', head: true }),
    supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
    supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeekIso),
  ]);

  return {
    total: totalRes.count ?? 0,
    today: todayRes.count ?? 0,
    thisWeek: weekRes.count ?? 0,
    error: totalRes.error?.message || todayRes.error?.message || weekRes.error?.message,
  };
}

// Re-export the type so the page can `import type { AuditLog } from '@/lib/actions/audit'`
// if it prefers a single import path.
export type { AuditLog, AuditLogWithActor };
