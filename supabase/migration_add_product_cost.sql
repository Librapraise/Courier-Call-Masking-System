-- GhostCRM: Add cost_per_unit column to products table for inventory cost valuation and profit tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10, 2) DEFAULT 0.0;

-- Optional: ensure index on product name and category
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
