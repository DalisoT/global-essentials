-- ============================================
-- FULL SHIPPING RATES MIGRATION - May 2026
-- TODAY CARGO – All Services
-- ============================================

-- Note: If running on an existing database where shipping_rates already exists
-- with the old 2-column constraint, run these steps in order:
--   1. ALTER TABLE shipping_rates RENAME TO shipping_rates_old;
--   2. Run the CREATE TABLE block below
--   3. Run the INSERT block

-- Create table with proper 3-column unique constraint
-- (run only if shipping_rates doesn't exist or was just renamed)
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipping_type VARCHAR(50) NOT NULL,
  carrier VARCHAR(50) NOT NULL,
  transit_days INTEGER NOT NULL,
  rate_type VARCHAR(20) NOT NULL,
  tier_min_kg DECIMAL(10,3) DEFAULT 0,
  tier_max_kg DECIMAL(10,3) DEFAULT NULL,
  rate DECIMAL(10,4) NOT NULL,
  volume_min_cbm DECIMAL(10,6) DEFAULT NULL,
  volume_max_cbm DECIMAL(10,6) DEFAULT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shipping_type, tier_min_kg, tier_max_kg)
);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_type ON shipping_rates(shipping_type);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON shipping_rates(is_active);

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view shipping rates" ON shipping_rates;
DROP POLICY IF EXISTS "Anyone can insert shipping rates" ON shipping_rates;
DROP POLICY IF EXISTS "Anyone can update shipping rates" ON shipping_rates;
CREATE POLICY "Anyone can view shipping rates" ON shipping_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shipping rates" ON shipping_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shipping rates" ON shipping_rates FOR UPDATE USING (true);

-- Clear existing and insert fresh rates
TRUNCATE TABLE shipping_rates CASCADE;

INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, tier_min_kg, tier_max_kg, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES
  ('air_general_7days', 'Air Express', 7, 'per_kg', 0.01, 9.99, 13.90, NULL, NULL, 'Air General 7D. No batteries, liquid, magnetic.', true),
  ('air_general_7days', 'Air Express', 7, 'per_kg', 10, NULL, 11.90, NULL, NULL, 'Air General 7D 10kg+. No batteries, liquid, magnetic.', true),
  ('air_sensitive_14days', 'Air Express', 14, 'per_kg', 0.01, 9.99, 15.90, NULL, NULL, 'Air Sensitive 14D. Electronics, liquid, magnetic allowed.', true),
  ('air_sensitive_14days', 'Air Express', 14, 'per_kg', 10, NULL, 13.90, NULL, NULL, 'Air Sensitive 14D 10kg+. Electronics, liquid, magnetic allowed.', true),
  ('sea_small_parcel', 'Sea Express VIP', 50, 'per_kg', 0.01, NULL, 3.90, NULL, NULL, 'Sea Small <0.1CBM. Duty included. 50 days.', true),
  ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 0, 0.999, 379.00, 0.1, 0.999, 'Sea CBM 0.1-0.999CBM. General goods. Duty included.', true),
  ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 0, 4.999, 369.00, 1.0, 4.999, 'Sea CBM 1-4.999CBM. General goods. Duty included.', true),
  ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 0, 9.999, 365.00, 5.0, 9.999, 'Sea CBM 5-9.999CBM. General goods. Duty included.', true),
  ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 0, NULL, 359.00, 10.0, NULL, 'Sea CBM 10CBM+. General goods. Duty included.', true),
  ('sea_heavy', 'Sea Express VIP', 50, 'per_ton', 0, NULL, 469.00, NULL, NULL, 'Sea Heavy. Per ton. Duty included. Brand products same price.', true);

-- Verify
SELECT shipping_type, rate_type, rate, tier_min_kg, tier_max_kg, volume_min_cbm, volume_max_cbm, description
FROM shipping_rates
ORDER BY shipping_type, volume_min_cbm NULLS LAST, tier_min_kg;
