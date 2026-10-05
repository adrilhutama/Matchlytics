-- ============================================================
-- VERIFICATION STEP 1: Check Grants on user_notifications
-- ============================================================
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_notifications';
