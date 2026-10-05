-- ============================================================
-- STEP 1: Drop old trigger and function
-- Run this FIRST
-- ============================================================
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.validate_profile_update();
DROP FUNCTION IF EXISTS public.check_profile_update();
