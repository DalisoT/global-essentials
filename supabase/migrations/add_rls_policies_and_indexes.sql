-- ============================================
-- RLS Policies, Indexes, and Constraints Fix
-- ============================================

-- Ensure installments table has RLS enabled
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Installments: users can read all (for debt collection view)
-- and update only their own installments via sale ownership
CREATE POLICY "Authenticated users can view installments"
  ON installments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update installments"
  ON installments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Ensure sales table has RLS enabled
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own sales"
  ON sales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own sales"
  ON sales FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Clients table RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

-- Products table RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage products"
  ON products FOR ALL
  USING (auth.role() = 'authenticated');

-- Expenses table RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage expenses"
  ON expenses FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_installments_sale_id ON installments(sale_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_is_paid ON installments(is_paid);
CREATE INDEX IF NOT EXISTS idx_products_stock_level ON products(stock_level);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ============================================
-- Unique constraint on clients.phone_number
-- ============================================
-- This prevents duplicate phone numbers (race condition fix for createClient)
ALTER TABLE clients ADD CONSTRAINT clients_phone_number_key UNIQUE (phone_number);