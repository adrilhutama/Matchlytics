-- ============================================================
-- Matchlytics Migration 20261005: User Notification System
-- Per-user in-app notifications for bet settlements and
-- watchlist price alerts. Zero em dash characters used.
-- ============================================================

-- 1. Create user_notifications table
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
    fixture_id  UUID REFERENCES public.fixtures(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.portfolio_positions(id) ON DELETE CASCADE,
    payload     JSONB,
    read        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_un_read   ON public.user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_un_user   ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_un_type   ON public.user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_un_created ON public.user_notifications(created_at DESC);

-- 2. Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Authenticated users can read their own notifications
CREATE POLICY "Users can read own notifications"
    ON public.user_notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Service role can insert/update notifications (for pipeline writes)
CREATE POLICY "Service role inserts notifications"
    ON public.user_notifications
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
