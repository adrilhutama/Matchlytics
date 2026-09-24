-- ============================================================
-- Matchlytics Migration 003: Optimized Standings & Home/Away Form
-- ============================================================

-- 1. Ensure settlement score columns exist on fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS home_score INT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS away_score INT;

-- 2. Create normalized team_standings table
CREATE TABLE IF NOT EXISTS public.team_standings (
  id TEXT PRIMARY KEY,
  league_code TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  team_crest TEXT,
  form TEXT,
  points INTEGER DEFAULT 0,
  home_played INTEGER DEFAULT 0,
  home_goals_for INTEGER DEFAULT 0,
  home_goals_against INTEGER DEFAULT 0,
  away_played INTEGER DEFAULT 0,
  away_goals_for INTEGER DEFAULT 0,
  away_goals_against INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite indexes for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_team_standings_league_team
ON public.team_standings (league_code, team_id);

CREATE INDEX IF NOT EXISTS idx_team_standings_team_id
ON public.team_standings (team_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.team_standings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'team_standings' AND policyname = 'Allow public read access on team_standings'
  ) THEN
    CREATE POLICY "Allow public read access on team_standings" 
    ON public.team_standings FOR SELECT USING (true);
  END IF;
END $$;

-- 4. Enable Supabase Realtime for team_standings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_standings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_standings;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
