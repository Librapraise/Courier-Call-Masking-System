-- Migration to alter foreign key constraint on call_logs table
-- Changes ON DELETE CASCADE to ON DELETE SET NULL for customer_id
-- This ensures deleting a customer does NOT delete their historical call logs & recordings.

ALTER TABLE call_logs
  DROP CONSTRAINT IF EXISTS call_logs_customer_id_fkey,
  ADD CONSTRAINT call_logs_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE SET NULL;
