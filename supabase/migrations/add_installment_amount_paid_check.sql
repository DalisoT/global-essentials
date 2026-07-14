-- Migration: add_installment_amount_paid_check.sql
-- Purpose: F8 from ROADMAP.md — guard rail so partial payments can never
--          over-pay an installment. Companion to recordInstallmentPayment's
--          atomic amount_paid += amount update (refactored in F5).
--
-- Safe to run on a populated DB: existing rows where amount_paid is NULL
-- (pre-migration) trivially satisfy `amount_paid IS NULL OR amount_paid <= amount_due`
-- because NULL is not > amount_due. Rows where amount_paid is already correctly
-- populated will continue to satisfy the constraint.
--
-- Reversible: ALTER TABLE installments DROP CONSTRAINT installments_amount_paid_le_due;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'installments_amount_paid_le_due'
  ) THEN
    ALTER TABLE installments
      ADD CONSTRAINT installments_amount_paid_le_due
      CHECK (amount_paid IS NULL OR amount_paid <= amount_due);
  END IF;
END$$;