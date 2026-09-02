-- Migration: Incoming WhatsApp Responses Table
-- Run this in your Supabase SQL Editor to enable storing WhatsApp text replies from customers.

CREATE TABLE IF NOT EXISTS whatsapp_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  profile_name TEXT,
  message_body TEXT NOT NULL,
  message_sid TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for searching replies by customer and date
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_customer ON whatsapp_replies(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_created_at ON whatsapp_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_phone ON whatsapp_replies(phone_number);

-- Enable RLS
ALTER TABLE whatsapp_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view whatsapp replies" ON whatsapp_replies;
DROP POLICY IF EXISTS "Admins can delete whatsapp replies" ON whatsapp_replies;
DROP POLICY IF EXISTS "System can insert whatsapp replies" ON whatsapp_replies;

-- Policies
CREATE POLICY "Admins can view whatsapp replies"
  ON whatsapp_replies FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete whatsapp replies"
  ON whatsapp_replies FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert whatsapp replies"
  ON whatsapp_replies FOR INSERT
  WITH CHECK (true);
