-- Verification queries to check if schema was created correctly
-- Run these in Supabase SQL Editor to verify your setup

-- 1. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'customers', 'call_logs')
ORDER BY table_name;

-- 2. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'customers', 'call_logs');

-- 3. Check if policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'users';

-- 5. Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';

