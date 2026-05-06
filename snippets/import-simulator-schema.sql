-- Shipping rates table for Import Simulator
CREATE TABLE shipping_rates (
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
  UNIQUE(shipping_type, tier_min_kg)
);

CREATE INDEX idx_shipping_rates_type ON shipping_rates(shipping_type);
CREATE INDEX idx_shipping_rates_active ON shipping_rates(is_active);

-- Custom exchange rates table
CREATE TABLE exchange_rates_custom (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_pair VARCHAR(20) NOT NULL UNIQUE,
  rate DECIMAL(12,6) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed shipping rates (update in app after running)
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, tier_min_kg, tier_max_kg, rate, description) VALUES
('air_general_7days', 'Air Express', 7, 'per_kg', 1, 9.999, 0, '1kg+ rate'),
('air_general_7days', 'Air Express', 7, 'per_kg', 10, NULL, 0, '10kg+ rate'),
('air_sensitive_14days', 'Air Express', 14, 'per_kg', 1, 9.999, 0, '1kg+ rate'),
('air_sensitive_14days', 'Air Express', 14, 'per_kg', 10, NULL, 0, '10kg+ rate'),
('sea_small_parcel', 'Sea Express', 50, 'per_kg', 0.001, NULL, 0, 'per kg'),
('sea_cbm', 'Sea Express', 50, 'per_cbm', 0, 0.099, 0, 'Small parcels'),
('sea_cbm', 'Sea Express', 50, 'per_cbm', 0.1, 0.999, 0, '0.1-1 CBM'),
('sea_cbm', 'Sea Express', 50, 'per_cbm', 1, NULL, 0, '1+ CBM'),
('sea_heavy', 'Sea Express', 50, 'per_ton', 0, NULL, 0, 'per ton');

-- Seed default exchange rate
INSERT INTO exchange_rates_custom (currency_pair, rate) VALUES ('USD_ZMW', 26.0000);

-- RLS for shipping_rates
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shipping rates" ON shipping_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shipping rates" ON shipping_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shipping rates" ON shipping_rates FOR UPDATE USING (true);

-- RLS for exchange_rates_custom
ALTER TABLE exchange_rates_custom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view exchange rates" ON exchange_rates_custom FOR SELECT USING (true);
CREATE POLICY "Anyone can update exchange rates" ON exchange_rates_custom FOR UPDATE USING (true);