-- ============================================================
-- VERIFICATION STEP 2: Check fixture_id Type
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_notifications'
  AND column_name = 'fixture_id';
