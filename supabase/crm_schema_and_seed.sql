-- ==============================================================================
-- GHOSTCRM DATABASE ARCHITECTURE & SEEDING (Phase 1)
-- Multi-Brand Telegram Ingestion • Inventory Depletion • Courier Cash Settlement
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  unit TEXT NOT NULL DEFAULT 'g', -- 'g' for grams, 'units' for piece counts
  stock_on_hand NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  min_stock_alert NUMERIC(10, 2) DEFAULT 10.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENHANCE / CREATE CUSTOMERS TABLE FOR GHOSTCRM
-- Notice: Customer Name is the Delivery Address (e.g. "מרקו לויז - הנשיאים 57 פתח תקווה")
CREATE TABLE IF NOT EXISTS crm_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address_name TEXT NOT NULL, -- Full street address as customer identity
  city TEXT NOT NULL,         -- Isolated city for geographic segmentation
  phone_number TEXT NOT NULL UNIQUE, -- Primary unique deterministic key (05X-XXXXXXX)
  telegram_handle TEXT,       -- @username
  customer_type TEXT DEFAULT 'קבוע', -- 'קבוע', 'חדש', 'VIP'
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

-- 4. COURIERS TABLE (Linked to profiles and Telegram aliases)
CREATE TABLE IF NOT EXISTS crm_couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g. "יצחק הגנן הסדרן", "Zig zag מנהל"
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
  menu_items TEXT NOT NULL,    -- What customer ordered from public menu (e.g. "2 גלאטו 33, 2 אלסקה")
  actual_items TEXT NOT NULL,  -- What warehouse item was deducted (e.g. "20g האני, 20g מלון")
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.0, -- Cash collected
  is_settled BOOLEAN DEFAULT FALSE, -- Reconciled in daily courier cash settlement
  raw_message TEXT,            -- Raw forwarded Telegram text for OPSEC audit
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_customer ON crm_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_brand ON crm_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_courier ON crm_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_city ON crm_orders(city);
CREATE INDEX IF NOT EXISTS idx_crm_orders_date ON crm_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_crm_orders_settled ON crm_orders(is_settled);

-- 6. INVENTORY TRANSACTIONS TABLE (Stock audit log: deductions, restocks, adjustments)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
  quantity NUMERIC(10, 2) NOT NULL, -- Negative for order deductions (e.g. -20.00), positive for restock
  reason TEXT NOT NULL, -- 'DISPATCH_DEDUCTION', 'RESTOCK', 'MANUAL_ADJUSTMENT'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_order ON inventory_transactions(order_id);

-- 7. COURIER DAILY CASH SETTLEMENTS ("סגירת קופה")
CREATE TABLE IF NOT EXISTS cash_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID NOT NULL REFERENCES crm_couriers(id) ON DELETE CASCADE,
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.0, -- Expected cash from orders
  amount_received NUMERIC(10, 2) NOT NULL DEFAULT 0.0, -- Physical cash handed over
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

-- Admins and Service Role have full access
CREATE POLICY "Admins full access to brands" ON brands FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_customers" ON crm_customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_couriers" ON crm_couriers FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to crm_orders" ON crm_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to inventory_transactions" ON inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access to cash_settlements" ON cash_settlements FOR ALL TO authenticated USING (true);

-- ==============================================================================
-- SEED DATA: 37 BRANDS / SUPPLIER PERSONAS
-- ==============================================================================
INSERT INTO brands (name) VALUES
  ('מנהל גיבוי הזמנות'),
  ('כיכר המדינה'),
  ('מעבר כיכר המדינה'),
  ('המחתרת בני אור'),
  ('נחמן הגדול'),
  ('גורילה הזמנות'),
  ('צמפיון הזמנות'),
  ('מלך התפזורות'),
  ('קוקיס'),
  ('המשגיחים'),
  ('הגנן'),
  ('המשפוחס'),
  ('דוקטור וויד'),
  ('אמריקה ישראל'),
  ('דוקטור באקס'),
  ('רפואי לחיים'),
  ('תמרה'),
  ('המתכון הסודי'),
  ('מלך הרפואי'),
  ('הפרח היומי'),
  ('זיג זג'),
  ('הקוסם'),
  ('בוב מארלי'),
  ('בית מרקחת כללית'),
  ('המחסנאי'),
  ('המותג'),
  ('יאלו'),
  ('הרפואי של המדינה'),
  ('מיץ גת הזמנות'),
  ('המומחים לרפואי'),
  ('אסף משלוחים'),
  ('גאנגו שופ'),
  ('גורילה שופ'),
  ('קאנה פיקס'),
  ('תן לי גראס'),
  ('דוקטור באץ'),
  ('טלא פפ')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- SEED DATA: WAREHOUSE PRODUCTS & 29/9 INVENTORY STOCK WITH ALIASES
-- ==============================================================================
INSERT INTO products (name, category, aliases, unit, stock_on_hand) VALUES
  -- רפואי פרימיום
  ('רפואי מוזל', 'רפואי פרימיום', ARRAY['מוזל', 'רפואי מוזל'], 'g', 35.0),
  ('רפואי מלון', 'רפואי פרימיום', ARRAY['מלון', 'רפואי מלון'], 'g', 20.0),
  ('רפואי דקסטר', 'רפואי פרימיום', ARRAY['דקסטר', 'רפואי דקסטר'], 'g', 527.0),
  ('רפואי גלאקסי', 'רפואי פרימיום', ARRAY['רפואי גלקסי', 'גלאקסי', 'גלקסי'], 'g', 68.0),
  ('רפואי האני', 'רפואי פרימיום', ARRAY['האני', 'רפואי האני'], 'g', 1453.0),

  -- פופקורן
  ('פופקורן כתום', 'פופקורן', ARRAY['פופקרן כתום', 'כתום פופקורן'], 'g', 490.0),
  ('פופקורן סגול', 'פופקורן', ARRAY['פופקרן סגול', 'סגול פופקורן'], 'g', 450.0),

  -- ביטים גנטיקה
  ('ביטים בירדיי קייק', 'ביטים גנטיקה', ARRAY['בירדיי קייק', 'ביטים בירטדיי קייק', 'בירדיי'], 'g', 205.0),
  ('ביטים סן דייגו', 'ביטים גנטיקה', ARRAY['סן דייגו', 'ביטים סאן דייגו'], 'g', 113.0),

  -- באצונים גנטיקה
  ('סודה טרייפ באצונים', 'באצונים גנטיקה', ARRAY['סודה טריפ באצונים', 'סודה טריפ', 'סודה טרייפ'], 'g', 6.5),
  ('פרפל באצונים', 'באצונים גנטיקה', ARRAY['פרפל', 'פרפל באצון'], 'g', 4.5),
  ('סופר באצונים', 'באצונים גנטיקה', ARRAY['סופר', 'סופר באצון'], 'g', 5.5),
  ('מאי טאי באצונים', 'באצונים גנטיקה', ARRAY['מאי טאי', 'מאיטאי'], 'g', 7.0),
  ('אלקטרה באצונים', 'באצונים גנטיקה', ARRAY['אלקטרה'], 'g', 5.0),
  ('קיפר באצונים', 'באצונים גנטיקה', ARRAY['קיפר', 'קיפר באצון'], 'g', 56.0),
  ('צ''יפס טריפ באצונים', 'באצונים גנטיקה', ARRAY['ציפס טריפ באצונים', 'ציפס טריפ', 'צ''יפס טריפ'], 'g', 80.0),
  ('בארי קרים באצונים', 'באצונים גנטיקה', ARRAY['בארי קרים', 'ברי קרים באצונים'], 'g', 76.0),
  ('בלו זושי באצונים', 'באצונים גנטיקה', ARRAY['בלו זושי', 'זושי באצונים'], 'g', 80.0),

  -- גדול גנטיקה
  ('ליברדי גדול', 'גדול גנטיקה', ARRAY['ליברטי גדול', 'ליברדי', 'ליברטי'], 'g', 24.0),
  ('צ''יפ טריפ גדול', 'גדול גנטיקה', ARRAY['ציפ טריפ גדול', 'טריפ ציפ גדול', 'טריפ צ''יפ גדול'], 'g', 0.0),
  ('בארי קרים גדול', 'גדול גנטיקה', ARRAY['בארי קרים', 'ברי קרים גדול'], 'g', 62.0),
  ('ריינבו גדול', 'גדול גנטיקה', ARRAY['ריינבאו גדול', 'ריינבו', 'ריינבאו'], 'g', 95.0),
  ('קיפר גדול', 'גדול גנטיקה', ARRAY['קיפר גדול', 'קיפר'], 'g', 115.0),
  ('זושי גדול', 'גדול גנטיקה', ARRAY['זושי גדול', 'זושי'], 'g', 80.0),

  -- קאלי יבוא
  ('למנייד יבוא', 'קאלי יבוא', ARRAY['למונייד יבוא', 'למנייד', 'למונייד'], 'g', 23.0),
  ('סקאנק יבוא', 'קאלי יבוא', ARRAY['סקאנק'], 'g', 53.0),
  ('ספלינט יבוא', 'קאלי יבוא', ARRAY['ספלינט'], 'g', 30.0),
  ('ריין יבוא', 'קאלי יבוא', ARRAY['ריין'], 'g', 40.0),
  ('אליזבת יבוא', 'קאלי יבוא', ARRAY['אליזבת'], 'g', 22.0),
  ('באבל גם יבוא', 'קאלי יבוא', ARRAY['באבלגאם יבוא', 'באבל גם', 'באבלגאם'], 'g', 34.0),
  ('זלושי יבוא', 'קאלי יבוא', ARRAY['זלושי'], 'g', 19.0),
  ('ריינבאו יבוא', 'קאלי יבוא', ARRAY['ריינבו יבוא', 'ריינבאו', 'ריינבו'], 'g', 43.0),

  -- תפזורות
  ('תפזורת בוטיק', 'תפזורות', ARRAY['תפזורת בוטיק'], 'g', 6248.0),
  ('תפזורת חממה', 'תפזורות', ARRAY['תפזורת חממה'], 'g', 55.0),
  ('תפזורת יקרה', 'תפזורות', ARRAY['תפזורת יקרה'], 'g', 4900.0),

  -- חשיש
  ('חשיש יבוא', 'חשיש', ARRAY['חשיש יבוא', 'יבוא חשיש'], 'g', 202.0),
  ('חשיש רגיל', 'חשיש', ARRAY['חשיש רגיל'], 'g', 0.0),
  ('פיתות חשיש רגיל', 'חשיש', ARRAY['פיתת חשיש', 'פיתות חשיש', 'פיתה חשיש'], 'units', 7.0),
  ('קוביות חשיש בלונדי', 'חשיש', ARRAY['קובית חשיש בלונדי', 'קוביות בלונדי', 'קוביה בלונדי'], 'units', 11.0),
  ('חשיש בלונדי', 'חשיש', ARRAY['בלונדי חשיש', 'בלונדי'], 'g', 34.0),

  -- מיוחדים - מיצוי גת
  ('מיצוי גת אדום', 'מיוחדים', ARRAY['גת אדום', 'מיצוי גת אדום'], 'units', 29.0),
  ('מיצוי גת ירוק', 'מיוחדים', ARRAY['גת ירוק', 'מיצוי גת ירוק'], 'units', 8.0),
  ('בקבוק מיץ גת', 'מיוחדים', ARRAY['מיץ גת', 'בקבוק גת'], 'units', 8.0),

  -- שמן קנאביס
  ('שמן קנאביס סאטיבה', 'שמן קנאביס', ARRAY['שמן סאטיבה', 'קנאביס סאטיבה'], 'units', 3.0),
  ('שמן קנאביס היברידי', 'שמן קנאביס', ARRAY['שמן היברידי', 'קנאביס היברידי'], 'units', 2.0),
  ('שמן קנאביס אינדיקה', 'שמן קנאביס', ARRAY['שמן אינדיקה', 'קנאביס אינדיקה'], 'units', 1.0),

  -- עטי אידוי
  ('עט אידוי', 'עטי אידוי', ARRAY['וייפ', 'עטי אידוי'], 'units', 20.0),

  -- אכילים
  ('אוראו כחול', 'אכילים', ARRAY['עוגיות אוראו כחול', 'אוראו כחול'], 'units', 22.0),
  ('אוראו חום', 'אכילים', ARRAY['עוגיות אוראו חום', 'אוראו חום'], 'units', 8.0),
  ('חמצוצים', 'אכילים', ARRAY['חמצוצים'], 'units', 11.0)
ON CONFLICT (name) DO UPDATE SET
  stock_on_hand = EXCLUDED.stock_on_hand,
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  updated_at = NOW();
