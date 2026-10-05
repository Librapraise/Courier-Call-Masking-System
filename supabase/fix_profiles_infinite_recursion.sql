-- =====================================================================
-- Migration: Fix Profiles Table Infinite Recursion in RLS Policy
-- =====================================================================
-- Problem:
-- Policies ON profiles that query "FROM public.profiles" cause Postgres
-- error 42P17: "infinite recursion detected in policy for relation 'profiles'".
--
-- Solution:
-- 1. Drop the recursive SELECT and DELETE policies on profiles.
-- 2. Use non-recursive JWT-based check (auth.jwt()) which checks the user's
--    role and metadata token claims in-memory without querying 'profiles'.
-- =====================================================================

-- 1. Drop existing recursive policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and warehousemen can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- 2. Allow users to view their own profile or staff to view all profiles (zero recursion)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin', 'warehouseman')
    OR (auth.jwt() -> 'user_metadata' ->> 'is_super_admin') = 'true'
  );

-- 3. Allow admins & super admins to delete profiles (zero recursion)
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'is_super_admin') = 'true'
  );

-- 4. Ensure profiles role check constraint allows all modern roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'courier', 'super_admin', 'warehouseman'));
