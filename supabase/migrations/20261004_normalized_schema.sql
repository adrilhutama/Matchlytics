-- ============================================================
-- Matchlytics Migration 20261004: Normalized Relational Schema
-- Normalized teams, fixtures foreign keys, multi-market metrics,
-- and institutional portfolio positions with rational odds caps.
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

-- 1. Create normalized public.teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id                  BIGINT PRIMARY KEY,
    name                TEXT NOT NULL,
    short_name          TEXT,
    tla                 TEXT,
    crest_url           TEXT,
    competition_code    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_comp ON public.teams(competition_code);
CREATE INDEX IF NOT EXISTS idx_teams_name ON public.teams(name);

-- 2. Add foreign keys and normalized quantitative columns to public.fixtures
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS home_xg NUMERIC(4, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS away_xg NUMERIC(4, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_over_25 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_under_25 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_btts_yes NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS market_odds JSONB;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS best_ev_opportunity JSONB;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS competition_code TEXT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS kickoff_time TIMESTAMPTZ;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS actual_home_score INT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS actual_away_score INT;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS fair_odds_home NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS fair_odds_draw NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS fair_odds_away NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_over_15 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_under_15 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_over_35 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_under_35 NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS prob_btts_no NUMERIC(5, 2);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS score_matrix JSONB;

-- Add foreign key constraints safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fixtures_home_team_id_fkey'
    ) THEN
        ALTER TABLE public.fixtures
        ADD CONSTRAINT fixtures_home_team_id_fkey
        FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fixtures_away_team_id_fkey'
    ) THEN
        ALTER TABLE public.fixtures
        ADD CONSTRAINT fixtures_away_team_id_fkey
        FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create public.portfolio_positions table with rational settlement caps
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
    id                  TEXT PRIMARY KEY,
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fixture_id          BIGINT REFERENCES public.fixtures(id) ON DELETE SET NULL,
    fixture_name        TEXT,
    league_name         TEXT,
    selection           TEXT NOT NULL,
    selection_label     TEXT,
    odds                NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    capped_odds         NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    stake_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status              TEXT NOT NULL DEFAULT 'PENDING',
    payout              NUMERIC(12, 2) DEFAULT 0.00,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    settled_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portfolio_status ON public.portfolio_positions(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_fixture ON public.portfolio_positions(fixture_id);

-- Enable RLS on portfolio_positions
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own portfolio positions"
ON public.portfolio_positions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for teams and portfolio_positions
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_positions;
