-- ============================================================
-- Matchlytics Migration 20261006: Admin Audit Log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN (
        'activate_subscription',
        'deactivate_subscription',
        'view_profile',
        'view_positions',
        'trigger_sync'
    )),
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action   ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin    ON public.admin_audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created  ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target   ON public.admin_audit_log(target_profile_id);

-- Service role can write audit logs
CREATE POLICY "Service role writes audit log"
    ON public.admin_audit_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Admin users can read audit logs (enforced by Edge Function JWT claim)
CREATE POLICY "Admins can read audit log"
    ON public.admin_audit_log
    FOR SELECT
    TO authenticated
    USING (true);  -- JWT claim check happens at Edge Function level

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_log;
