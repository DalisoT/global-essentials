-- Migration: enable_product_variants_rls.sql
-- Purpose: Close the security gap flagged by the Supabase linter
--          ("Table public.product_variants is public, but RLS has
--          not been enabled"). Every other business table in the
--          app (products, sales, clients, installments, etc.) has
--          RLS enabled — this is the last unprotected one.
--
-- product_variants is a shared business resource (size, color, SKU,
-- stock_level, price_modifier) — there is no per-user ownership,
-- so the correct policy is "any authenticated user can do anything",
-- which is the same pattern as the other shared tables (clients,
-- products, expenses). All app-side queries go through requireAuth
-- (lib/actions/variants.ts, lib/actions/barcode.ts), so a logged-in
-- staff member has full access and the anon key is blocked.
--
-- Re-runnable: the DROP POLICY IF EXISTS + CREATE POLICY pair is
-- idempotent on Postgres 15+ (Supabase runs PG 15). The ALTER TABLE
-- is also safe to re-run — enabling RLS on an already-protected
-- table is a no-op.

-- ─────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- Policies
--
-- One umbrella policy for ALL operations. product_variants has no
-- per-row ownership column, so a single "any authenticated user"
-- policy is the right shape — it blocks the anon key without
-- adding a per-user filter that would be artificial for a
-- single-tenant POS.
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can manage product_variants"
  ON product_variants;

CREATE POLICY "Authenticated users can manage product_variants"
  ON product_variants
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
