-- ============================================================
-- Football Pre-Analysis Platform — Supabase Migration 001
-- ============================================================
-- Run this in: Supabase Dashboard > SQL Editor > New Query

-- Enable UUID extension (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Main fixtures table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fixtures (
    id              BIGINT PRIMARY KEY,           -- API-Football fixture ID
    league_id       INT,
    league_name     TEXT,
    league_logo     TEXT,
    league_country  TEXT,
    season          INT DEFAULT 2025,

    match_date      TIMESTAMPTZ,
    status          TEXT,                         -- 'NS', 'FT', '1H', 'HT', '2H', etc.

    home_team_id    INT,
    home_team_name  TEXT,
    home_team_logo  TEXT,
    away_team_id    INT,
    away_team_name  TEXT,
    away_team_logo  TEXT,

    -- Poisson parameters
    lambda_home     NUMERIC(4, 2),
    lambda_away     NUMERIC(4, 2),

    -- Win/Draw/Loss probabilities (percentages, e.g. 52.30)
    prob_home       NUMERIC(5, 2),
    prob_draw       NUMERIC(5, 2),
    prob_away       NUMERIC(5, 2),

    -- Most likely scoreline e.g. "2-1"
    predicted_score TEXT,

    -- Market probabilities (percentages)
    prob_over_25    NUMERIC(5, 2),
    prob_btts       NUMERIC(5, 2),

    -- Bet365 decimal odds
    odds_home       NUMERIC(5, 2),
    odds_draw       NUMERIC(5, 2),
    odds_away       NUMERIC(5, 2),

    -- Value bet detection
    value_pick      TEXT CHECK (value_pick IN ('HOME', 'DRAW', 'AWAY') OR value_pick IS NULL),
    ev_percentage   NUMERIC(5, 2),               -- e.g. 8.50 means +8.5% EV

    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for frontend query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fixtures_match_date   ON public.fixtures (match_date);
CREATE INDEX IF NOT EXISTS idx_fixtures_league_id    ON public.fixtures (league_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_value_pick   ON public.fixtures (value_pick);
CREATE INDEX IF NOT EXISTS idx_fixtures_status       ON public.fixtures (status);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

-- Public read policy: anon key can SELECT all rows (frontend reads)
CREATE POLICY "Allow public read access"
    ON public.fixtures
    FOR SELECT
    TO anon
    USING (true);

-- Service role can do everything (used by Python scripts)
-- Note: service_role bypasses RLS by default in Supabase, so no extra policy needed.

-- ============================================================
-- Helper view: upcoming matches only (next 7 days)
-- Useful for testing queries
-- ============================================================
CREATE OR REPLACE VIEW public.upcoming_fixtures AS
    SELECT *
    FROM public.fixtures
    WHERE match_date >= NOW()
      AND match_date <= NOW() + INTERVAL '7 days'
      AND status = 'NS'
    ORDER BY match_date ASC;

COMMENT ON TABLE public.fixtures IS
    'Pre-computed football match analytics. Populated by GitHub Actions daily sync.';
