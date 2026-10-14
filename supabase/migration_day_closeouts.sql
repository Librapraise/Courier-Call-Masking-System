-- =============================================================================
-- Migration: Daily Closeout & End-of-Day Shift Reset ("סגירת יום / Z-Report")
-- Enables flexible day closeout at any hour (00:00, 01:00, etc.) with automatic
-- Telegram dispatch to warehouseman and accounting manager.
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_day_closeouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  closeout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
  shift_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_orders INTEGER NOT NULL DEFAULT 0,
  gross_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  total_courier_pay NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  total_bonus NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  net_to_safe NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  courier_breakdown JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for chronological closeout queries
CREATE INDEX IF NOT EXISTS idx_crm_day_closeouts_date
  ON crm_day_closeouts (created_at DESC);

-- Row Level Security
ALTER TABLE crm_day_closeouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to crm_day_closeouts"
  ON crm_day_closeouts FOR ALL TO authenticated USING (true);
