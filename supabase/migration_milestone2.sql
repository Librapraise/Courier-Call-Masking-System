-- Milestone 2: Enhanced schema for call logging, settings, and archiving

-- Enhance call_logs table with all required fields
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone_masked TEXT,
  ADD COLUMN IF NOT EXISTS call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS call_duration INTEGER, -- Duration in seconds
  ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on twilio_call_sid for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_sid ON call_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(call_timestamp);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(call_status);

-- Create settings table for system configuration
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('daily_reset_time', '00:00', 'Daily reset time in HH:MM format (24-hour)'),
  ('daily_reset_timezone', 'Asia/Jerusalem', 'Timezone for daily reset'),
  ('incoming_call_behavior', 'message', 'Behavior for incoming calls: "block" or "message"'),
  ('incoming_call_message', 'This number is for outbound calls only. Please wait for our agent to call you.', 'Message to play for incoming calls'),
  ('business_phone_number', '', 'Business phone number for caller ID'),
  ('twilio_account_sid', '', 'Twilio Account SID (stored for reference, use env var for actual calls)'),
  ('last_reset_date', '', 'Last date when daily reset was performed')
ON CONFLICT (key) DO NOTHING;

-- Create archived_calls table for daily reset archiving
CREATE TABLE IF NOT EXISTS archived_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_call_log_id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_phone_masked TEXT,
  courier_id UUID,
  call_status TEXT NOT NULL,
  call_timestamp TIMESTAMP WITH TIME ZONE,
  call_duration INTEGER,
  twilio_call_sid TEXT,
  agent_name TEXT,
  error_message TEXT,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archive_date DATE NOT NULL -- Date when archived (for querying by date)
);

-- Create index on archive_date for faster queries
CREATE INDEX IF NOT EXISTS idx_archived_calls_date ON archived_calls(archive_date);
CREATE INDEX IF NOT EXISTS idx_archived_calls_timestamp ON archived_calls(call_timestamp);

-- Enable RLS on new tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
-- Only admins can view and update settings
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update settings"
  ON settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for archived_calls
-- Admins can view all archived calls
CREATE POLICY "Admins can view archived calls"
  ON archived_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to mask phone numbers (show last 4 digits only)
CREATE OR REPLACE FUNCTION mask_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL OR LENGTH(phone) < 4 THEN
    RETURN '****';
  END IF;
  RETURN '****' || RIGHT(phone, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on call_logs
DROP TRIGGER IF EXISTS update_call_logs_updated_at ON call_logs;
CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on settings
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

