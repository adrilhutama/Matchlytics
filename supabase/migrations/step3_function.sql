-- ============================================================
-- STEP 3: Create validation function
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger AS $func$
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Cannot change subscription_tier';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot change subscription_status';
  END IF;

  IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'Cannot change current_period_end';
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY INVOKER;
