-- Migration: Add RLS policy for users to update their own phone number
-- Run this if you already have the database set up and need to add the phone number update policy

-- Users can update their own phone number
CREATE POLICY "Users can update own phone number"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

