-- ============================================================
-- Migration 20261015: API Quota Telemetry Table & RPC
-- ============================================================
-- Persists daily quota snapshots from Football Data API and
-- The Odds API so the Admin Dashboard can display utilization
-- progress bars, remaining counts, and reset countdowns.
-- ============================================================

-- Drop existing objects if migration is re-run
DROP TABLE IF EXISTS public.api_quota_log;
DROP FUNCTION IF EXISTS public.get_api_quota_metrics();

-- ---- Quota log table ----
CREATE TABLE public.api_quota_log (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,           -- 'football_data' | 'odds_api'
  day           DATE NOT NULL,
  requests_used BIGINT NOT NULL DEFAULT 0,
  limit_daily   BIGINT NOT NULL DEFAULT 0,
  remaining     BIGINT,
  reset_at      TIMESTAMPTZ,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, day)
);

-- ---- Indexes ----
CREATE INDEX idx_api_quota_log_provider_day ON public.api_quota_log (provider, day DESC);
CREATE INDEX idx_api_quota_log_captured_at ON public.api_quota_log (captured_at DESC);

-- ---- RLS ----
ALTER TABLE public.api_quota_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read api quota log" ON public.api_quota_log;
CREATE POLICY "Admin read api quota log"
  ON public.api_quota_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service write api quota log" ON public.api_quota_log;
CREATE POLICY "Service write api quota log"
  ON public.api_quota_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---- RPC: get_api_quota_metrics() ----
CREATE OR REPLACE FUNCTION public.get_api_quota_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result        JSONB;
  v_today         DATE := CURRENT_DATE;
  v_now           TIMESTAMPTZ := NOW();
  v_ffd_agg       JSONB;
  v_odds_agg      JSONB;
  v_ffd_used      BIGINT;
  v_ffd_limit     BIGINT;
  v_ffd_remaining BIGINT;
  v_reset_ts      TIMESTAMPTZ;
  v_odds_used     BIGINT;
  v_odds_limit    BIGINT;
  v_odds_remaining BIGINT;
BEGIN
  -- ---- Football Data API (today) ----
  SELECT COALESCE(agg, '{}') INTO v_ffd_agg
  FROM (
    SELECT
      COALESCE(SUM(requests_used), 0)         AS requests_used,
      COALESCE(MAX(limit_daily), 0)           AS limit_daily,
      COALESCE(MAX(remaining), NULL)          AS remaining,
      COALESCE(MAX(reset_at), NULL)           AS reset_at
    FROM public.api_quota_log
    WHERE provider = 'football_data' AND day = v_today
  ) sub;

  -- Rolling 7-day total for Football Data
  SELECT COALESCE(SUM(requests_used), 0) INTO v_ffd_used
  FROM public.api_quota_log
  WHERE provider = 'football_data' AND day >= v_today - INTERVAL '6 days';

  v_ffd_limit  := COALESCE((v_ffd_agg->>'limit_daily')::BIGINT, 0);
  v_ffd_remaining := COALESCE((v_ffd_agg->>'remaining')::BIGINT, 0);
  v_reset_ts   := (v_ffd_agg->>'reset_at')::TIMESTAMPTZ;

  -- ---- The Odds API (today) ----
  SELECT COALESCE(agg, '{}') INTO v_odds_agg
  FROM (
    SELECT
      COALESCE(SUM(requests_used), 0)         AS requests_used,
      COALESCE(MAX(limit_daily), 0)           AS limit_daily,
      COALESCE(MAX(remaining), NULL)          AS remaining,
      COALESCE(MAX(reset_at), NULL)           AS reset_at
    FROM public.api_quota_log
    WHERE provider = 'odds_api' AND day = v_today
  ) sub;

  -- Rolling 7-day total for Odds API
  SELECT COALESCE(SUM(requests_used), 0) INTO v_odds_used
  FROM public.api_quota_log
  WHERE provider = 'odds_api' AND day >= v_today - INTERVAL '6 days';

  v_odds_limit     := COALESCE((v_odds_agg->>'limit_daily')::BIGINT, 0);
  v_odds_remaining := COALESCE((v_odds_agg->>'remaining')::BIGINT, 0);
  v_reset_ts       := (v_odds_agg->>'reset_at')::TIMESTAMPTZ;

  -- ---- Build Football Data JSON ----
  v_ffd_agg := jsonb_build_object(
    'provider',        'football_data',
    'provider_label',  'Football Data API',
    'requests_used',   v_ffd_used,
    'limit_daily',     GREATEST(v_ffd_limit, 1),
    'remaining',       v_ffd_remaining,
    'reset_at',        v_reset_ts,
    'countdown_sec',   GREATEST(EXTRACT(EPOCH FROM (COALESCE(v_reset_ts, v_now + INTERVAL '1 hour') - v_now))::BIGINT, 0),
    'utilization_pct', ROUND(
      CASE WHEN v_ffd_limit > 0 THEN (v_ffd_used::NUMERIC / v_ffd_limit) * 100 ELSE 0 END, 1
    ),
    'health_color',    CASE
                         WHEN v_ffd_limit = 0 THEN 'gray'
                         WHEN v_ffd_used * 100 / GREATEST(v_ffd_limit, 1) < 70 THEN 'emerald'
                         WHEN v_ffd_used * 100 / GREATEST(v_ffd_limit, 1) < 90 THEN 'amber'
                         ELSE 'rose'
                       END,
    'sample_count',    (SELECT COUNT(*) FROM public.api_quota_log WHERE provider = 'football_data' AND day >= v_today - INTERVAL '6 days')
  );

  -- ---- Build Odds API JSON ----
  v_odds_agg := jsonb_build_object(
    'provider',        'odds_api',
    'provider_label',  'The Odds API',
    'requests_used',   v_odds_used,
    'limit_daily',     GREATEST(v_odds_limit, 1),
    'remaining',       v_odds_remaining,
    'reset_at',        v_reset_ts,
    'countdown_sec',   GREATEST(EXTRACT(EPOCH FROM (COALESCE(v_reset_ts, v_now + INTERVAL '1 hour') - v_now))::BIGINT, 0),
    'utilization_pct', ROUND(
      CASE WHEN v_odds_limit > 0 THEN (v_odds_used::NUMERIC / v_odds_limit) * 100 ELSE 0 END, 1
    ),
    'health_color',    CASE
                         WHEN v_odds_limit = 0 THEN 'gray'
                         WHEN v_odds_used * 100 / GREATEST(v_odds_limit, 1) < 70 THEN 'emerald'
                         WHEN v_odds_used * 100 / GREATEST(v_odds_limit, 1) < 90 THEN 'amber'
                         ELSE 'rose'
                       END,
    'sample_count',    (SELECT COUNT(*) FROM public.api_quota_log WHERE provider = 'odds_api' AND day >= v_today - INTERVAL '6 days')
  );

  -- ---- Build final result ----
  v_result := jsonb_build_object(
    'computed_at', v_now,
    'football_data', v_ffd_agg,
    'odds_api',      v_odds_agg,
    'status',        CASE
                       WHEN v_ffd_limit > 0 AND v_ffd_used * 100 / v_ffd_limit >= 95 THEN 'critical'
                       WHEN v_odds_limit > 0 AND v_odds_used * 100 / v_odds_limit >= 95 THEN 'critical'
                       WHEN v_ffd_limit > 0 AND v_ffd_used * 100 / v_ffd_limit >= 70  THEN 'warning'
                       WHEN v_odds_limit > 0 AND v_odds_used * 100 / v_odds_limit >= 70  THEN 'warning'
                       ELSE 'healthy'
                     END
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.get_api_quota_metrics() TO authenticated;
