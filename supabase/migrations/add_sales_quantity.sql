-- Migration: add_sales_quantity.sql
-- Purpose: Track quantity sold per sale row so per-product units_sold is accurate
--          (previously, profitability.ts counted each sale row as 1 unit, which
--          was wrong for multi-item sales).
--
-- Safe to run on a populated DB: defaults existing rows to 1.
-- Reversible: ALTER TABLE sales DROP COLUMN quantity;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Backfill is implicit via DEFAULT 1 — no UPDATE needed.

-- Guard rail: cannot sell zero or negative quantity.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_quantity_positive'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0);
  END IF;
END$$;

-- Index for aggregation queries (per-product totals over a date range).
CREATE INDEX IF NOT EXISTS idx_sales_product_created
  ON sales(product_id, created_at DESC);