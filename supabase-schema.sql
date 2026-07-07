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

-- ============================================================================
-- PHASE 1: ACCOUNTING (Double-entry bookkeeping)
-- ============================================================================

-- Chart of Accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  -- asset | liability | equity | revenue | expense
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  -- current | long_term  (only relevant for asset/liability)
  subtype VARCHAR(20),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_active ON accounts(is_active);

-- Journal Entries (header)
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  -- sale | expense | installment_payment | adjustment | opening
  reference_type VARCHAR(40),
  reference_id UUID,
  -- Sum of debits (always equals sum of credits; stored for quick lookup)
  total_amount DECIMAL(12,2) NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX idx_journal_entries_ref ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_created ON journal_entries(created_at DESC);

-- Journal Lines (debit/credit)
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  -- Debit or Credit
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Payment methods (typed)
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- cash | mobile_money | bank | card
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(60) NOT NULL,
  -- account_id in chart of accounts where money lands
  cash_account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default Chart of Accounts for a small retail/import business
INSERT INTO accounts (code, name, type, subtype, description) VALUES
  ('1000', 'Cash on Hand',           'asset',     'current',    'Physical cash in the till'),
  ('1010', 'Mobile Money',           'asset',     'current',    'Mobile money balance'),
  ('1020', 'Bank Account',           'asset',     'current',    'Business bank account'),
  ('1200', 'Accounts Receivable',    'asset',     'current',    'Money owed by customers (pay-slow)'),
  ('1300', 'Inventory',              'asset',     'current',    'Goods held for sale'),
  ('2000', 'Accounts Payable',       'liability', 'current',    'Money owed to suppliers'),
  ('3000', 'Owner''s Equity',         'equity',                  'Owner investment + retained earnings'),
  ('4000', 'Sales Revenue',          'revenue',                 'Revenue from product sales'),
  ('5000', 'Cost of Goods Sold',     'expense',                 'Direct cost of items sold'),
  ('6000', 'Rent Expense',           'expense',                 'Shop / warehouse rent'),
  ('6010', 'Utilities',              'expense',                 'Electricity, water, internet'),
  ('6020', 'Transport',              'expense',                 'Delivery & travel'),
  ('6030', 'Marketing',              'expense',                 'Advertising & promotions'),
  ('6040', 'Salaries',               'expense',                 'Staff wages'),
  ('6050', 'Packaging',              'expense',                 'Bags, boxes, wrapping'),
  ('6060', 'Airtime & Data',         'expense',                 'Phone & internet airtime'),
  ('6090', 'General Expenses',       'expense',                 'Anything not classified'),
  ('7000', 'Shipping & Import Fees', 'expense',                 'Customs, freight, duties'),
  ('7010', 'Cost of Returns',        'expense',                 'Refunds and write-offs');

-- Link payment methods to cash accounts
INSERT INTO payment_methods (code, name, cash_account_id) VALUES
  ('cash',         'Cash',         (SELECT id FROM accounts WHERE code = '1000')),
  ('mobile_money', 'Mobile Money', (SELECT id FROM accounts WHERE code = '1010')),
  ('bank',         'Bank',         (SELECT id FROM accounts WHERE code = '1020')),
  ('card',         'Card',         (SELECT id FROM accounts WHERE code = '1020'));

-- RLS — authenticated users can read; writes go through server actions
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view accounts" ON accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view journals" ON journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view lines" ON journal_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view audit" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view payment methods" ON payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view methods" ON payment_methods FOR SELECT TO authenticated USING (true);

-- Helper view: account balances
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a.subtype,
  COALESCE(SUM(CASE WHEN jl.entry_type = 'debit'  THEN jl.amount ELSE 0 END), 0) AS total_debits,
  COALESCE(SUM(CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE 0 END), 0) AS total_credits,
  COALESCE(SUM(CASE WHEN jl.entry_type = 'debit'  THEN jl.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE 0 END), 0)
    AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type, a.subtype;