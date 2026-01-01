-- Migration: Add courier assignment to customers
-- This allows splitting customers between multiple couriers

-- Add assigned_courier_id column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS assigned_courier_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_assigned_courier ON customers(assigned_courier_id) WHERE assigned_courier_id IS NOT NULL;

-- Create a function to check if user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- Allow admins to view all profiles (needed to see courier list for assignment)
-- Using the function to avoid RLS recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Update RLS policy for couriers to only see their assigned customers
-- Drop both old and new policy names in case either exists
DROP POLICY IF EXISTS "Couriers can view customer names only" ON customers;
DROP POLICY IF EXISTS "Couriers can view assigned customer names only" ON customers;

-- New policy: Couriers can only see customers assigned to them
CREATE POLICY "Couriers can view assigned customer names only"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'courier'
      AND customers.is_active = TRUE
      AND (
        customers.assigned_courier_id = auth.uid()
        OR customers.assigned_courier_id IS NULL  -- Allow unassigned customers to be visible to all couriers (optional)
      )
    )
  );

-- Update admin policy for customers to use the function (avoids recursion)
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;
CREATE POLICY "Admins can manage all customers"
  ON customers FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

