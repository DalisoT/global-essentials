-- Migration: set_account_balances_security_invoker.sql
-- Purpose: Close the Supabase linter warning "View
--          public.account_balances is defined with the SECURITY
--          DEFINER property". SECURITY DEFINER views run with
--          the view creator's permissions, bypassing RLS on the
--          underlying tables. SECURITY INVOKER (the Postgres 15+
--          default for new views) runs with the QUERYING user's
--          permissions, so RLS on `accounts` and `journal_lines`
--          applies normally.
--
-- Why this is the right fix:
--   - The view is a read-only aggregate over accounts + journal_lines.
--   - Both base tables have RLS enabled with policies that grant
--     SELECT to the `authenticated` role.
--   - With SECURITY INVOKER, an authenticated staff member queries
--     the view and gets only the rows their RLS allows (which is
--     "all of them" for these tables). The anon role gets nothing
--     because there's no anon policy.
--   - With SECURITY DEFINER, the view ran as the superuser and
--     bypassed those policies, so the anon key could read account
--     balances if it had SELECT on the view.
--
-- Re-runnable: ALTER VIEW ... SET (...) is idempotent on Postgres 15+
-- (Supabase's runtime).

ALTER VIEW public.account_balances SET (security_invoker = true);

-- Make sure the querying roles can read the view. Supabase's default
-- `public` schema GRANTs already cover this, but we re-state it
-- explicitly so the policy is obvious from this migration.
GRANT SELECT ON public.account_balances TO anon, authenticated;
