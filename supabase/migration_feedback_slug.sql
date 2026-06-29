-- Migration: Add feedback slug column to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS feedback_slug TEXT UNIQUE;

-- Create an index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_feedback_slug ON customers(feedback_slug);
