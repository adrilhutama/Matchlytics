-- ============================================================
-- STEP 4: Create trigger
-- ============================================================
CREATE TRIGGER validate_profile_update_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_update();
