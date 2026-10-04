-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'courier')),
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  call_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own phone number" ON profiles;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own phone number
CREATE POLICY "Users can update own phone number"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for customers
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Couriers can view customer names only" ON customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;

-- Couriers can only SELECT customer names (not phone numbers)
CREATE POLICY "Couriers can view customer names only"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'courier'
      AND customers.is_active = TRUE
    )
  );

-- Admins can SELECT, INSERT, UPDATE, DELETE all customer data
CREATE POLICY "Admins can manage all customers"
  ON customers FOR ALL
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

-- RLS Policies for call_logs
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can insert call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can view own call logs" ON call_logs;

-- All authenticated users can INSERT into call_logs
CREATE POLICY "Authenticated users can insert call logs"
  ON call_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own call logs
CREATE POLICY "Users can view own call logs"
  ON call_logs FOR SELECT
  USING (
    auth.uid() = courier_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'courier');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- GHOSTCRM EXTENSION SCHEMA & SEEDING
-- ==============================================================================

-- 1. BRANDS TABLE (Pre-seeded with 37 brand personas)
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PRODUCTS TABLE (Live warehouse catalog with units, categories, and alias arrays)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  unit TEXT NOT NULL DEFAULT 'g',
  stock_on_hand NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  min_stock_alert NUMERIC(10, 2) DEFAULT 10.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CUSTOMERS TABLE FOR GHOSTCRM (Customer Name = Delivery Address)
CREATE TABLE IF NOT EXISTS crm_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address_name TEXT NOT NULL,
  city TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  telegram_handle TEXT,
  customer_type TEXT DEFAULT 'קבוע',
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0.0,
  last_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_city ON crm_customers(city);
CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON crm_customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_crm_customers_brand ON crm_customers(last_brand_id);

-- 4. COURIERS TABLE (Linked to Telegram aliases and profiles)
CREATE TABLE IF NOT EXISTS crm_couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  telegram_id BIGINT UNIQUE,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ORDERS TABLE (Captures Menu items vs. Actual Warehouse Deductions)
CREATE TABLE IF NOT EXISTS crm_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id),
  courier_id UUID REFERENCES crm_couriers(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  menu_items TEXT NOT NULL,
  actual_items TEXT NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  is_settled BOOLEAN DEFAULT FALSE,
  raw_message TEXT,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_customer ON crm_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_brand ON crm_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_courier ON crm_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_city ON crm_orders(city);
CREATE INDEX IF NOT EXISTS idx_crm_orders_date ON crm_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_crm_orders_settled ON crm_orders(is_settled);

-- 6. INVENTORY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_order ON inventory_transactions(order_id);

-- 7. COURIER DAILY CASH SETTLEMENTS
CREATE TABLE IF NOT EXISTS cash_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID NOT NULL REFERENCES crm_couriers(id) ON DELETE CASCADE,
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  amount_received NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  difference NUMERIC(10, 2) GENERATED ALWAYS AS (amount_received - total_collected) STORED,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SETTLED', 'DISCREPANCY')),
  notes TEXT,
  settled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_courier_date ON cash_settlements(courier_id, settlement_date);

-- Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to brands" ON brands FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_customers" ON crm_customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_couriers" ON crm_couriers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_orders" ON crm_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to inventory_transactions" ON inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to cash_settlements" ON cash_settlements FOR ALL TO authenticated USING (true);


