-- ============================================
-- Add amount_paid and note columns to installments
-- Enables partial payments and backdated payment recording
-- ============================================

ALTER TABLE installments
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS note text DEFAULT NULL;