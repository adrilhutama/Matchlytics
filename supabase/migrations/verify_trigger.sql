-- ============================================================
-- VERIFICATION STEP 4: Check Trigger Status
-- ============================================================
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'validate_profile_update_trigger';
