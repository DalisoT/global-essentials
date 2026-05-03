-- Appwrite Setup Instructions
-- Create these collections in your Appwrite database

-- 1. Create database named "global_essentials"

-- 2. Create collection: products
-- Attributes:
--   name: string (required)
--   cost_price: float (required)
--   selling_price: float (required)
--   stock_level: integer (required, default: 0)
--   image_url: string (optional)

-- 3. Create collection: clients
-- Attributes:
--   full_name: string (required)
--   phone_number: string (required)

-- 4. Create collection: sales
-- Attributes:
--   product_id: string (required)
--   client_id: string (required)
--   total_amount: float (required)
--   payment_status: string (required) - Enum: ["paid", "pending"]
--   payment_method: string (required) - Enum: ["cash", "pay-slow"]

-- 5. Create collection: installments
-- Attributes:
--   sale_id: string (required)
--   amount_due: float (required)
--   due_date: string (required)
--   is_paid: boolean (required, default: false)
--   paid_at: string (optional)

-- 6. Create collection: expenses
-- Attributes:
--   description: string (required)
--   amount: float (required)
--   category: string (required)

-- 7. Storage bucket: product-images
--    Settings: Public read, Authenticated create/update

-- 8. Indexes to create:
--    products: name (fulltext), stock_level (asc)
--    sales: payment_status (asc), product_id (asc)
--    installments: sale_id (asc), is_paid (asc), due_date (asc)
--    expenses: category (asc), $createdAt (desc)
