-- ============================================================
-- COMPREHENSIVE VERIFICATION QUERY
-- Run this to verify ALL fixes
-- ============================================================

-- 1. Check user_notifications grants
SELECT 'user_notifications grants' as check_name;
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'user_notifications'
ORDER BY grantee, privilege_type;

-- 2. Check fixture_id type
SELECT 'fixture_id type' as check_name;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'fixture_id';

-- 3. Check all profiles
SELECT 'admin profiles' as check_name;
SELECT id, email, is_admin, subscription_tier, subscription_status
FROM public.profiles
ORDER BY is_admin DESC, created_at DESC;

-- 4. Check RLS policies on profiles
SELECT 'profiles RLS policies' as check_name;
SELECT policyname, cmd, roles,
  CASE WHEN using IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 5. Check trigger exists
SELECT 'trigger status' as check_name;
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'validate_profile_update_trigger';

-- 6. Check redundant indexes are gone
SELECT 'redundant indexes' as check_name;
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status');

-- 7. Check new indexes exist
SELECT 'new indexes' as check_name;
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN ('idx_portfolio_user_status_created', 'idx_profiles_created');
