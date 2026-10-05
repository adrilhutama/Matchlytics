-- ============================================================
-- Matchlytics Database Audit Verification Script
-- Run this AFTER applying migration 20261007
-- ============================================================

-- ------------------------------------------------------------
-- 1. Verify RLS Policies
-- ------------------------------------------------------------
SELECT '=== RLS POLICIES ===' as check_name;

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  CASE when using is not null then 'YES' else 'NO' end as has_using,
  CASE when with_check is not null then 'YES' else 'NO' end as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ------------------------------------------------------------
-- 2. Verify Table Grants
-- ------------------------------------------------------------
SELECT '=== TABLE GRANTS ===' as check_name;

SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

-- ------------------------------------------------------------
-- 3. Verify Indexes
-- ------------------------------------------------------------
SELECT '=== INDEXES ===' as check_name;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ------------------------------------------------------------
-- 4. Verify Column Types (fixture_id fix)
-- ------------------------------------------------------------
SELECT '=== COLUMN TYPES ===' as check_name;

SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('fixtures', 'user_notifications')
  AND column_name IN ('id', 'fixture_id')
ORDER BY table_name, column_name;

-- ------------------------------------------------------------
-- 5. Verify Foreign Key Constraints
-- ------------------------------------------------------------
SELECT '=== FOREIGN KEYS ===' as check_name;

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ------------------------------------------------------------
-- 6. Verify profiles.is_admin Column Exists
-- ------------------------------------------------------------
SELECT '=== PROFILES IS_ADMIN COLUMN ===' as check_name;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'is_admin';

-- ------------------------------------------------------------
-- 7. Check RLS Enabled on All Tables
-- ------------------------------------------------------------
SELECT '=== RLS ENABLED ===' as check_name;

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ------------------------------------------------------------
-- 8. Verify No Duplicate Indexes Remain
-- ------------------------------------------------------------
SELECT '=== REDUNDANT INDEX CHECK ===' as check_name;

SELECT
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status')
ORDER BY indexname;

-- Should return 0 rows if migration succeeded

-- ------------------------------------------------------------
-- 9. Count Notifications by Read Status
-- ------------------------------------------------------------
SELECT '=== NOTIFICATIONS STATS ===' as check_name;

SELECT
  read as is_read,
  count(*) as notification_count
FROM public.user_notifications
GROUP BY read;

-- ------------------------------------------------------------
-- 10. Check Admin Users
-- ------------------------------------------------------------
SELECT '=== ADMIN USERS ===' as check_name;

SELECT
  p.id,
  p.email,
  p.subscription_tier,
  p.is_admin,
  p.created_at
FROM public.profiles p
WHERE p.is_admin = true
ORDER BY p.created_at;
