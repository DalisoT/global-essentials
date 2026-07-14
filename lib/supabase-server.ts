'use server';

import { createServerClient } from '@supabase/ssr';
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