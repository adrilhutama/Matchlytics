-- ============================================================
-- VERIFICATION STEP 5: Check Indexes
-- ============================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
