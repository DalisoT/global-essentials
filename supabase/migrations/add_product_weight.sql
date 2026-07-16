-- Migration: add_product_weight.sql
-- Purpose: Phase 11 / 11.2 — product weight is needed to compute
--          shipping cost for pre-orders (weight × rate per kg).
--          Defaulted to 1.0 kg so the deposit math works out of
--          the box; the user can adjust per product.
--
-- Re-runnable: idempotent.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 1.00
    CHECK (weight_kg > 0 AND weight_kg <= 100);

COMMENT ON COLUMN products.weight_kg IS
  'Product weight in kg. Used by the pre-order deposit calculation (Phase 11). Default 1.0 kg; the user should adjust per product based on real supplier specs.';

-- Same for variants: per-size weight override.
-- Useful if a size 10 boot weighs noticeably more than a size 6.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6, 2) CHECK (weight_kg > 0);

COMMENT ON COLUMN product_variants.weight_kg IS
  'Optional per-size weight override in kg. Falls back to products.weight_kg. Phase 11.';
