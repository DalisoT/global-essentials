-- ============================================
-- Add catalog visibility, catalog price, and stock restoration tracking
-- ============================================

-- Add visibility toggle (default true = visible)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_visible_in_catalog BOOLEAN NOT NULL DEFAULT true;

-- Add separate catalog price (nullable - falls back to selling_price)
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_price DECIMAL(12,2);

-- Index for catalog visibility filter
CREATE INDEX IF NOT EXISTS idx_products_visible_catalog ON products(is_visible_in_catalog) WHERE is_visible_in_catalog = true;

-- Cancellation timestamp for audit
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;