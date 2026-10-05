-- =============================================================================
-- Migration: Settlement V2 — Courier Bill-of-Money System
-- Run this in the Supabase SQL Editor to add the new financial columns.
-- =============================================================================

-- Add new financial columns to cash_settlements
ALTER TABLE cash_settlements
  ADD COLUMN IF NOT EXISTS gross_collected    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_pay        NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_expected       NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill existing rows so they are consistent
UPDATE cash_settlements
SET
  gross_collected = total_collected,
  courier_pay     = 0,
  bonus_amount    = 0,
  net_expected    = total_collected
WHERE gross_collected = 0;

-- Add helpful index for querying settlements by courier and date
CREATE INDEX IF NOT EXISTS idx_cash_settlements_courier_date
  ON cash_settlements (courier_id, created_at DESC);
