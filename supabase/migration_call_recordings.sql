-- Migration: Add call recording support to call_logs and archived_calls

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration INTEGER;

ALTER TABLE archived_calls
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration INTEGER;

-- Create index on recording_sid for quick webhook updates
CREATE INDEX IF NOT EXISTS idx_call_logs_recording_sid ON call_logs(recording_sid);
