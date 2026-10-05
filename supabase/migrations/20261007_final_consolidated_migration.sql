-- ============================================================
-- Matchlytics Final Consolidated Migration
-- Applies ALL pending schema changes safely and idempotently
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PHASE 1: FIX user_notifications TABLE
-- ------------------------------------------------------------
-- The table was created in migration 20261005 but with WRONG
-- fixture_id type (UUID instead of BIGINT). We recreate it.

-- Drop broken table if it exists (with all its dependencies)
DROP TABLE IF EXISTS public.user_notifications CASCADE;

-- Recreate with correct types
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN (
        'bet_settled',
        'odds_drop',
        'subscription_renewal',
        'subscription_expiring',
        'watchlist_trigger'
    )),
    fixture_id  BIGINT REFERENCES public.fixtures(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.portfolio_positions(id) ON DELETE CASCADE,
    payload     JSONB,
    read        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_un_read   ON public.user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_un_user   ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_un_type   ON public.user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_un_created ON public.user_notifications(created_at DESC);

-- RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Grant SELECT to client roles (THE FIX)
GRANT SELECT ON public.user_notifications TO anon;
GRANT SELECT ON public.user_notifications TO authenticated;

-- Policy: users read own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.user_notifications;
CREATE POLICY "Users can read own notifications"
    ON public.user_notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: service role writes
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.user_notifications;
CREATE POLICY "Service role inserts notifications"
    ON public.user_notifications
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Realtime
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
-- PHASE 2: FIX admin_audit_log POLICY
-- ------------------------------------------------------------
-- Current policy allows ANY authenticated user to read all logs.
-- Fix: restrict to users with is_admin = true.

-- Add is_admin column to profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;

-- Create restricted policy
CREATE POLICY "Only admins can read audit log"
    ON public.admin_audit_log
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.is_admin = true
      )
    );


-- ------------------------------------------------------------
-- PHASE 3: FIX profiles UPDATE POLICY
-- ------------------------------------------------------------
-- Current policy allows updating ANY column including subscription.
-- Fix: freeze entitlement columns with WITH CHECK.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Freeze entitlement columns: user can only update display fields
CREATE POLICY "Users can update own profile, entitlement columns frozen"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = new.id
      AND new.subscription_tier = (
        SELECT subscription_tier FROM public.profiles WHERE id = auth.uid()
      )
      AND new.subscription_status = (
        SELECT subscription_status FROM public.profiles WHERE id = auth.uid()
      )
      AND new.current_period_end = (
        SELECT current_period_end FROM public.profiles WHERE id = auth.uid()
      )
      AND new.is_admin = (
        SELECT is_admin FROM public.profiles WHERE id = auth.uid()
      )
    );


-- ------------------------------------------------------------
-- PHASE 4: DROP REDUNDANT INDEXES
-- ------------------------------------------------------------
-- These are superseded by partial composite indexes from migration 002.

DROP INDEX IF EXISTS idx_fixtures_match_date;
DROP INDEX IF EXISTS idx_fixtures_status;


-- ------------------------------------------------------------
-- PHASE 5: ADD NEW INDEXES
-- ------------------------------------------------------------
-- Composite index for portfolio queries
CREATE INDEX IF NOT EXISTS idx_portfolio_user_status_created
    ON public.portfolio_positions (user_id, status, created_at DESC);

-- Index for admin profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_created
    ON public.profiles (created_at DESC);


-- ------------------------------------------------------------
-- PHASE 6: VERIFY AND REPORT
-- ------------------------------------------------------------
-- This section runs verification queries and returns results.
-- Safe to run repeatedly.

DO $$
DECLARE
  v_user_notifications_exists boolean;
  v_is_admin_exists boolean;
  v_fixture_id_type text;
  v_redundant_indexes integer;
BEGIN
  -- Check user_notifications exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_notifications'
  ) INTO v_user_notifications_exists;

  -- Check is_admin column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) INTO v_is_admin_exists;

  -- Check fixture_id type
  SELECT data_type INTO v_fixture_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'fixture_id';

  -- Check redundant indexes removed
  SELECT count(*) INTO v_redundant_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('idx_fixtures_match_date', 'idx_fixtures_status');

  -- Return verification results
  RAISE NOTICE '====================================';
  RAISE NOTICE 'MIGRATION VERIFICATION RESULTS';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'user_notifications table: %', CASE WHEN v_user_notifications_exists THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'profiles.is_admin column: %', CASE WHEN v_is_admin_exists THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'fixture_id data_type: %', COALESCE(v_fixture_id_type, 'N/A');
  RAISE NOTICE 'Redundant indexes remaining: %', v_redundant_indexes;
  RAISE NOTICE '====================================';

  IF v_redundant_indexes > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: redundant indexes still exist';
  END IF;
END $$;
