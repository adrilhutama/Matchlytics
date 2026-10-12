-- ============================================================
-- Migration 20261013: Security Hardening & Schema Fixes
-- ============================================================
-- Fixes:
-- 1. Add missing value_pick and ev_percentage columns to fixtures
-- 2. Fix profiles UPDATE policy with WITH CHECK clause
-- 3. Add UPDATE policy for user_notifications
-- 4. Restrict table privileges for anon/authenticated roles
-- ============================================================

-- 1. Add missing columns to fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS value_pick TEXT CHECK (value_pick IN ('HOME', 'DRAW', 'AWAY') OR value_pick IS NULL);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS ev_percentage NUMERIC(5, 2);

-- 2. Fix profiles UPDATE policy - add WITH CHECK to prevent self-escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Add UPDATE policy for user_notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;
CREATE POLICY "Users can update own notifications"
    ON public.user_notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Restrict table privileges
-- Fixtures: readonly for anon/authenticated
REVOKE ALL ON public.fixtures FROM anon, authenticated;
GRANT SELECT ON public.fixtures TO anon, authenticated;

-- Profiles: readonly for anon/authenticated
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

-- Admin audit log: only authenticated can read, service_role writes
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;

-- User notifications: authenticated can read and update own, service_role writes
REVOKE ALL ON public.user_notifications FROM anon, authenticated;
GRANT SELECT ON public.user_notifications TO authenticated;

-- 5. Update existing policies to use modern syntax (TO role instead of auth.role())
-- These are already using modern syntax, so no changes needed here.
