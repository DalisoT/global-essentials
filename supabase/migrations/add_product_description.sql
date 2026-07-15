-- Migration: add_product_description.sql
-- Purpose: Phase 8 / 8.1 from ROADMAP.md — add a `description` column
--          to `products` so the catalog can show long-form product
--          copy. The 8.1 action `generateProductDescription` uses
--          Groq to draft the description from the product's name,
--          category, price, and stock context, which the user
--          then reviews and edits before publishing.
--
-- Catalog consumers:
--   - Public catalog: app/catalog/* (browse + product detail)
--   - Cart/Checkout: shows the description on the product page
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS is safe to re-run.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Description is for the public catalog, so NULL = 'no description
-- yet'. The catalog UI should show a placeholder for NULL. We don't
-- add a default — that would let the AI write copy into the table
-- without a human review step, which is the wrong default.
