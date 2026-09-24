-- ============================================================
-- Matchlytics Migration 002: Performance, RLS Hardening & Realtime
-- ============================================================

-- 1. High-Performance Composite Partial Indexes
-- Optimized for upcoming active feed (filtered by status and ordered by date)
CREATE INDEX IF NOT EXISTS idx_fixtures_active_feed
ON public.fixtures (league_id, match_date ASC)
WHERE status = 'NS';

-- Optimized for value bets queries
CREATE INDEX IF NOT EXISTS idx_fixtures_value_bets
ON public.fixtures (match_date ASC)
WHERE status = 'NS' AND value_pick IS NOT NULL;

-- 2. Row Level Security (RLS) Audit & Hardening
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fixtures' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.fixtures FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Housekeeping: Clean Stale Fixtures Function
CREATE OR REPLACE FUNCTION clean_stale_fixtures()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.fixtures
  WHERE match_date < NOW() - INTERVAL '45 days'
    AND status IN ('FINISHED', 'FT', 'AET', 'PEN');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable Supabase Realtime for fixtures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fixtures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fixtures;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback in case publication already includes all tables or environment restrictions
    NULL;
END $$;

COMMENT ON FUNCTION clean_stale_fixtures() IS 
  'Housekeeping routine to prune match records older than 45 days.';
