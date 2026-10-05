-- ============================================================
-- SUPABASE DATABASE AUDIT VERIFICATION CHECKLIST
-- Matchlytics by imortifex
-- Run each query individually in Supabase SQL Editor
-- ============================================================

-- ============================================
-- QUERY 1: RLS Policies Overview
-- Expected: Should show policies for all tables
-- ============================================
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected results:
-- profiles: "Users can view own profile" (SELECT), "Users can update own profile, entitlement columns frozen" (UPDATE)
-- user_notifications: "Users can read own notifications" (SELECT)
-- admin_audit_log: "Only admins can read audit log" (SELECT)
-- fixtures, team_standings: "Allow public read access" (SELECT)


-- ============================================
-- QUERY 2: Grants on Critical Tables
-- Expected: user_notifications should have SELECT for anon/authenticated
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_notifications', 'profiles', 'admin_audit_log')
ORDER BY table_name, grantee;

-- Expected for user_notifications:
-- table_name: user_notifications | grantee: anon | privilege_type: SELECT
-- table_name: user_notifications | grantee: authenticated | privilege_type: SELECT
-- table_name: user_notifications | grantee: service_role | privilege_type: INSERT
-- table_name: user_notifications | grantee: service_role | privilege_type: UPDATE


-- ============================================
-- QUERY 3: fixture_id Type Fix Verification
-- Expected: Both fixtures.id and user_notifications.fixture_id should be bigint
-- ============================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('fixtures', 'user_notifications')
  AND column_name IN ('id', 'fixture_id')
ORDER BY table_name;

-- Expected results:
-- fixtures | id | bigint
-- user_notifications | fixture_id | bigint (NOT uuid!)
-- user_notifications | id | uuid


-- ============================================
-- QUERY 4: is_admin Column Exists
-- Expected: Column should exist with default false
-- ============================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'is_admin';

-- Expected:
-- column_name: is_admin | data_type: boolean | column_default: false | is_nullable: NO


-- ============================================
-- QUERY 5: Admin Users List
-- Expected: Show which users have is_admin = true
-- ============================================
SELECT id, email, is_admin, subscription_tier, created_at
FROM public.profiles
ORDER BY is_admin DESC, created_at DESC
LIMIT 10;

-- If empty, run this to set admin:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';


-- ============================================
-- QUERY 6: Redundant Indexes Removed?
-- Expected: Should return 0 rows (indexes dropped)
-- ============================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status');

-- Expected: Empty result set


-- ============================================
-- QUERY 7: New Composite Indexes Exist?
-- Expected: Should show 2 new indexes
-- ============================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_portfolio_user_status_created', 'idx_profiles_created');

-- Expected:
-- idx_portfolio_user_status_created | portfolio_positions
-- idx_profiles_created | profiles


-- ============================================
-- QUERY 8: Foreign Key Integrity
-- Expected: user_notifications.fixture_id references fixtures.id
-- ============================================
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'user_notifications'
ORDER BY tc.table_name;

-- Expected:
-- constraint_name: user_notifications_fixture_id_fkey
-- table_name: user_notifications
-- column_name: fixture_id
-- foreign_table: fixtures
-- foreign_column: id


-- ============================================
-- QUERY 9: RLS Enabled on All Tables
-- Expected: All tables should have rowsecurity = true
-- ============================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: All tables show true for rowsecurity


-- ============================================
-- QUERY 10: Check Notification Counts
-- Expected: Should show notification stats (or 0 if empty)
-- ============================================
SELECT
  CASE WHEN read = true THEN 'read' ELSE 'unread' END as status,
  count(*) as count
FROM public.user_notifications
GROUP BY read
ORDER BY status;
