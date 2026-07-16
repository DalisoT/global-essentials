-- Migration: add_sales_pre_order_link.sql
-- Purpose: Phase 11 / 11.3 — link sales to pre-orders so a
--          converted pre-order carries a reference to the
--          sale it became.
--
-- Re-runnable: idempotent.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS pre_order_id UUID REFERENCES pre_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_pre_order
  ON sales (pre_order_id)
  WHERE pre_order_id IS NOT NULL;

COMMENT ON COLUMN sales.pre_order_id IS
  'When this sale was created by converting a pre-order, the pre_order it came from. NULL for normal sales. Phase 11.';
