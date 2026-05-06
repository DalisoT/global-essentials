-- PROFILES TABLE (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'staff',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add search_vector column to products
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- Add search_vector column to clients
ALTER TABLE clients ADD COLUMN search_vector tsvector;

-- Create search indexes
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_clients_search ON clients USING GIN(search_vector);

-- Function to update search_vector
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_client_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', COALESCE(NEW.full_name, '') || ' ' || COALESCE(NEW.phone_number, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep search_vector updated
CREATE OR REPLACE TRIGGER products_search_vector_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

CREATE OR REPLACE TRIGGER clients_search_vector_update
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_client_search_vector();

-- Update existing rows
UPDATE products SET search_vector = to_tsvector('english', name);
UPDATE clients SET search_vector = to_tsvector('english', full_name || ' ' || phone_number);

-- Add barcode column to products
ALTER TABLE products ADD COLUMN barcode VARCHAR(100) UNIQUE;
CREATE INDEX idx_products_barcode ON products(barcode);

-- Add deleted_at columns for soft delete
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sales ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_clients_deleted ON clients(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_sales_deleted ON sales(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_expenses_deleted ON expenses(deleted_at) WHERE deleted_at IS NOT NULL;

-- Product variants table
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(50),
  color VARCHAR(50),
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  stock_level INTEGER DEFAULT 0,
  price_modifier DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_barcode ON product_variants(barcode);

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

-- NOTE: Shipping rates should be managed via the Import Simulator UI
-- Seed with initial template rates (update these as needed via the app)
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, tier_min_kg, tier_max_kg, rate, description) VALUES
-- Air shipping (general)
('air_general_7days', 'Air Express', 7, 'per_kg', 1, 9.999, 0, '1kg+ rate - update in app'),
('air_general_7days', 'Air Express', 7, 'per_kg', 10, NULL, 0, '10kg+ rate - update in app'),
-- Air shipping (sensitive)
('air_sensitive_14days', 'Air Express', 14, 'per_kg', 1, 9.999, 0, '1kg+ rate - update in app'),
('air_sensitive_14days', 'Air Express', 14, 'per_kg', 10, NULL, 0, '10kg+ rate - update in app'),
-- Sea shipping (small parcel)
('sea_small_parcel', 'Sea Express', 50, 'per_kg', 0.001, NULL, 0, 'per kg - update in app'),
-- Sea shipping (CBM)
('sea_cbm', 'Sea Express', 50, 'per_cbm', 0, 0.099, 0, 'Small parcels - update in app'),
('sea_cbm', 'Sea Express', 50, 'per_cbm', 0.1, 0.999, 0, '0.1-1 CBM - update in app'),
('sea_cbm', 'Sea Express', 50, 'per_cbm', 1, NULL, 0, '1+ CBM - update in app'),
-- Sea shipping (heavy)
('sea_heavy', 'Sea Express', 50, 'per_ton', 0, NULL, 0, 'per ton - update in app');

-- Seed default exchange rate (USD to ZMW) - update in app
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