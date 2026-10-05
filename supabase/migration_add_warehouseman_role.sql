-- =====================================================================
-- Migration: Add Warehouseman / Store Manager Role to Profiles & RLS
-- =====================================================================

-- 1. Drop old constraint and add updated check constraint supporting 'warehouseman'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'courier', 'super_admin', 'warehouseman'));

-- 2. Update RLS policy so warehouse managers can view profiles in CRM team roster
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and warehousemen can view all profiles" ON profiles;

CREATE POLICY "Admins and warehousemen can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'warehouseman')
    )
  );

-- 3. Ensure RLS on products & inventory allows warehouseman
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Staff can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'warehouseman')
    )
  );

COMMENT ON COLUMN profiles.role IS 'User roles: admin (Dispatcher), courier (Courier Driver), super_admin (Super Admin), warehouseman (Warehouse / Store Manager)';
