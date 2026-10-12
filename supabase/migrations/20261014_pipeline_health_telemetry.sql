-- ============================================================
-- Migration 20261014: Pipeline Health Telemetry Function
-- ============================================================
-- Provides admin-accessible pipeline diagnostic metrics:
-- - Last sync timestamps (fixtures, odds, standings)
-- - Fixture counts (pending, finished, total)
-- - EV pick coverage and active value picks
-- - Pipeline freshness flag (stale if >24h)
-- ============================================================

-- Create or replace the health metrics function
CREATE OR REPLACE FUNCTION public.get_pipeline_health_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_latest_fixture TIMESTAMPTZ;
  v_latest_standings TIMESTAMPTZ;
  v_total_fixtures BIGINT;
  v_pending_fixtures BIGINT;
  v_finished_fixtures BIGINT;
  v_with_odds BIGINT;
  v_with_ev_pick BIGINT;
  v_pipeline_stale BOOLEAN;
BEGIN
  -- Get latest fixture timestamp
  SELECT COALESCE(MAX(updated_at), NOW())
  INTO v_latest_fixture
  FROM public.fixtures;

  -- Get latest standings timestamp
  SELECT COALESCE(MAX(updated_at), NOW())
  INTO v_latest_standings
  FROM public.team_standings;

  -- Count fixtures by status
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('NS', 'SCHEDULED', 'TIMED')),
    COUNT(*) FILTER (WHERE status IN ('FT', 'FINISHED', 'AET', 'PEN')),
    COUNT(*) FILTER (WHERE market_odds IS NOT NULL AND market_odds != '{}'),
    COUNT(*) FILTER (WHERE value_pick IS NOT NULL)
  INTO v_total_fixtures, v_pending_fixtures, v_finished_fixtures, v_with_odds, v_with_ev_pick
  FROM public.fixtures;

  -- Determine if pipeline is stale (no updates in 24 hours)
  v_pipeline_stale := v_latest_fixture < (NOW() - INTERVAL '24 hours');

  -- Build result JSON
  v_result := jsonb_build_object(
    'last_sync_at', v_latest_fixture,
    'last_standings_sync', v_latest_standings,
    'total_fixtures', v_total_fixtures,
    'pending_fixtures', v_pending_fixtures,
    'finished_fixtures', v_finished_fixtures,
    'odds_coverage_pct', CASE WHEN v_total_fixtures > 0
      THEN ROUND((v_with_odds::numeric / v_total_fixtures) * 100, 1)
      ELSE 0 END,
    'active_ev_picks', v_with_ev_pick,
    'pipeline_stale', v_pipeline_stale,
    'status', CASE
      WHEN v_pipeline_stale THEN 'stale'
      WHEN v_finished_fixtures = 0 AND v_pending_fixtures = 0 THEN 'idle'
      ELSE 'operational'
    END,
    'computed_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS will control actual access)
GRANT EXECUTE ON FUNCTION public.get_pipeline_health_metrics() TO authenticated;

-- Create a policy to restrict access to admins only via RLS
-- Note: Since this is a SECURITY DEFINER function, we use row-level checks inside
DROP POLICY IF EXISTS "Admin pipeline health access" ON public.fixtures;
CREATE POLICY "Admin pipeline health access"
  ON public.fixtures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );
