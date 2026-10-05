-- ============================================================
-- Matchlytics Final Consolidated Migration (SIMPLIFIED)
-- Applies ALL pending schema changes safely and idempotently
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PHASE 1: FIX user_notifications TABLE
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.user_notifications CASCADE;

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'bet_settled',
        'odds_drop',
        'subscription_renewal',
        'subscription_expiring',
        'watchlist_trigger'
    )),
    fixture_id BIGINT REFERENCES public.fixtures(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.portfolio_positions(id) ON DELETE CASCADE,
    payload JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_un_read ON public.user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_un_user ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_un_type ON public.user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_un_created ON public.user_notifications(created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_notifications TO anon;
GRANT SELECT ON public.user_notifications TO authenticated;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.user_notifications;
CREATE POLICY "Users can read own notifications"
    ON public.user_notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role inserts notifications" ON public.user_notifications;
CREATE POLICY "Service role inserts notifications"
    ON public.user_notifications
    FOR INSERT TO service_role WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ------------------------------------------------------------
-- PHASE 2: ADD is_admin COLUMN TO PROFILES
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;


-- ------------------------------------------------------------
-- PHASE 3: FIX admin_audit_log POLICY
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;

CREATE POLICY "Only admins can read audit log"
    ON public.admin_audit_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.is_admin = true
      )
    );


-- ------------------------------------------------------------
-- PHASE 4: FIX PROFILES UPDATE (TRIGGER-BASED)
-- ------------------------------------------------------------
-- Use a trigger to freeze entitlement columns (more reliable than RLS WITH CHECK)

-- Create validation function
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger AS $$
BEGIN
  -- Only allow updates to non-entitlement columns
  IF NEW.subscription_tier != OLD.subscription_tier THEN
    RAISE EXCEPTION 'Cannot change subscription_tier';
  END IF;

  IF NEW.subscription_status != OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot change subscription_status';
  END IF;

  IF NEW.current_period_end != OLD.current_period_end THEN
    RAISE EXCEPTION 'Cannot change current_period_end';
  END IF;

  IF NEW.is_admin != OLD.is_admin THEN
    RAISE EXCEPTION 'Cannot change is_admin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Attach trigger
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON public.profiles;
CREATE TRIGGER validate_profile_update_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_update();

-- Keep simple RLS policy (ownership check only)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);


-- ------------------------------------------------------------
-- PHASE 5: DROP REDUNDANT INDEXES
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_fixtures_match_date;
DROP INDEX IF EXISTS idx_fixtures_status;


-- ------------------------------------------------------------
-- PHASE 6: ADD NEW INDEXES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_portfolio_user_status_created
    ON public.portfolio_positions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_created
    ON public.profiles (created_at DESC);


-- ------------------------------------------------------------
-- PHASE 7: VERIFICATION
-- ------------------------------------------------------------
DO $$
DECLARE
  v_notifications_exists boolean;
  v_is_admin_exists boolean;
  v_fixture_bigint boolean;
  v_redundant_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_notifications'
  ) INTO v_notifications_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) INTO v_is_admin_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_notifications'
    AND column_name = 'fixture_id' AND data_type = 'bigint'
  ) INTO v_fixture_bigint;

  SELECT count(*) INTO v_redundant_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status');

  RAISE NOTICE '====================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'user_notifications: %', CASE WHEN v_notifications_exists THEN 'OK ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'is_admin column: %', CASE WHEN v_is_admin_exists THEN 'OK ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'fixture_id is BIGINT: %', CASE WHEN v_fixture_bigint THEN 'OK ✓' ELSE 'FAILED ✗' END;
  RAISE NOTICE 'Redundant indexes: %', CASE WHEN v_redundant_count = 0 THEN 'CLEAN ✓' ELSE 'REMAINING ✗' END;
  RAISE NOTICE '====================================';
END $$;
