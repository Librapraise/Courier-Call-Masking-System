-- GhostCRM: Enable Supabase Realtime for instant push updates (<100ms)
-- Run this script in the Supabase SQL Editor if Realtime is not yet enabled on CRM tables.

DO $$
BEGIN
  -- Add crm_orders to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_orders;
  END IF;

  -- Add crm_couriers to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_couriers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_couriers;
  END IF;

  -- Add products to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  -- Add cash_settlements to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'cash_settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_settlements;
  END IF;

  -- Add crm_day_closeouts to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_day_closeouts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_day_closeouts;
  END IF;
END $$;
