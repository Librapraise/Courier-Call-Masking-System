-- Migration: Customer Feedback System
-- Run this in your Supabase SQL editor to create the feedback table and update customers.

-- 1. Add is_completed column to customers table if it doesn't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Create index on is_completed for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_is_completed ON customers(is_completed);

-- 2. Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE UNIQUE, -- One feedback per customer/delivery
  courier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delivery_time_rating INTEGER NOT NULL CHECK (delivery_time_rating BETWEEN 1 AND 5),
  product_quality_rating INTEGER NOT NULL CHECK (product_quality_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for feedback
DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;

-- Anyone can insert feedback (since customers click the link from SMS and submit without log in)
CREATE POLICY "Anyone can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- Admins can select (view) all feedback using the public.is_admin function
CREATE POLICY "Admins can view feedback"
  ON feedback FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON feedback FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Create indexes for foreign key fields to speed up queries
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_courier ON feedback(courier_id);
