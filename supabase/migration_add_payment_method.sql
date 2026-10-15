-- =============================================================================
-- Migration: Add Payment Method & Prepaid Tracking to crm_orders & Closeouts
-- Allows tracking orders paid via Bit, Credit, or Prepaid (₪0 cash to collect)
-- and separates Physical Cash from Bit/Credit Provider Balances in Z-Reports
-- =============================================================================

ALTER TABLE crm_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS is_prepaid BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_crm_orders_payment_method ON crm_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_crm_orders_is_prepaid ON crm_orders(is_prepaid);

-- Backfill existing orders that mention Bit or Prepaid in their raw text
UPDATE crm_orders
SET
  payment_method = 'BIT',
  is_prepaid = TRUE
WHERE
  raw_message ILIKE '%ביט%' OR
  raw_message ILIKE '%bit%';

UPDATE crm_orders
SET
  payment_method = 'PREPAID',
  is_prepaid = TRUE
WHERE
  (raw_message ILIKE '%שולם מראש%' OR raw_message ILIKE '%לגבות 0%')
  AND is_prepaid = FALSE;

-- Add Bit & Physical Cash columns to crm_day_closeouts and cash_settlements
ALTER TABLE crm_day_closeouts
  ADD COLUMN IF NOT EXISTS total_bit_credit NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_physical_cash NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_provider_balance NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE cash_settlements
  ADD COLUMN IF NOT EXISTS bit_collected NUMERIC(10, 2) DEFAULT 0;
