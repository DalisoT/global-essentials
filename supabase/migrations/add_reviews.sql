-- ============================================
-- Product Reviews and Ratings
-- ============================================

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching reviews by product
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id) WHERE is_approved = true;

-- RLS for reviews
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved reviews" ON product_reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Anyone can insert reviews" ON product_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can manage reviews" ON product_reviews FOR UPDATE USING (auth.role() = 'authenticated');