-- Migration: add_product_lead_time.sql
-- Purpose: Phase 7 / 7.7 from ROADMAP.md — add a `lead_time_days`
--          column to `products` so the smart-reorder alert can
--          answer "will my stock last until my next supplier
--          delivery?" (forecast demand vs current stock vs
--          lead time).
--
-- Default 7 days is a sensible Zambia small-retail value for
-- locally-sourced goods. The inventory edit form (7.7 follow-up)
-- will let the user override per-product.
--
-- Re-runnable: every statement uses IF NOT EXISTS / DO blocks.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 7;

-- Lead time is a positive integer, capped at 365 (one year) so a
-- typo doesn't accidentally turn a product into "never reorderable".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_lead_time_positive'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_lead_time_positive
      CHECK (lead_time_days > 0 AND lead_time_days <= 365);
  END IF;
END$$;
