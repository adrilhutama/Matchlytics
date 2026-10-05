-- ============================================================
-- VERIFICATION STEP 3: Check Admin Profiles
-- ============================================================
SELECT id, email, is_admin, subscription_tier, subscription_status
FROM public.profiles
ORDER BY is_admin DESC, created_at DESC;
