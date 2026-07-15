'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY from
 * trusted server contexts:
 *   - Vercel Cron jobs (no logged-in user)
 *   - Background workers
 *   - Webhooks from trusted third parties
 *
 * Never import this from a file that's reachable from a user
 * request. The auth boundary for this client is the CRON_SECRET
 * check at the top of the API route that uses it.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` in env. Falls back to the
 * anon key in dev so local `pnpm dev` doesn't break — log a
 * warning when that happens.
 */
export async function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'createServiceRoleClient: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[supabase-server] SUPABASE_SERVICE_ROLE_KEY not set; falling back to anon key. ' +
        'Cron and webhook routes that depend on bypassing RLS will NOT work in production.'
    );
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAuth(): Promise<{ supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string } | { error: string; supabase?: never; userId?: never }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  return { supabase, userId: user.id };
}

/**
 * Admin gate. Returns the auth context (supabase + userId + role) or an error.
 * Use this for surfaces that only admins should reach (e.g. the audit log viewer
 * added in F10, and the future Phase 6 owner-only tools).
 *
 * The role lookup is a single `.select('role').single()` on profiles; the RLS
 * policy on `profiles` already restricts reads to `auth.uid() = id` so a
 * malicious caller cannot peek at other users' roles.
 */
export async function requireAdmin(): Promise<
  | { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string; role: string }
  | { error: string; supabase?: never; userId?: never; role?: never }
> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError) {
    return { error: 'Could not load profile' };
  }

  const role = (profile as { role?: string } | null)?.role || 'staff';
  if (role !== 'admin') {
    return { error: 'Admin access required' };
  }

  return { supabase, userId, role };
}