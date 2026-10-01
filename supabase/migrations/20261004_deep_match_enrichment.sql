-- ============================================================
-- Matchlytics Migration 20261004: Deep Match & Team Enrichment
-- Adds venue, referee, and head-to-head history to fixtures,
-- and home/away attack and defense power ratings to teams.
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

-- 1. Enrich public.fixtures with venue, referee, and H2H intelligence
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS venue VARCHAR(120);
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS referee JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS h2h_data JSONB DEFAULT '{}'::jsonb;

-- 2. Enrich public.teams with split Home/Away strength metrics for Poisson lambda calibration
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS home_attack NUMERIC(6, 4) DEFAULT 1.0000;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS home_defense NUMERIC(6, 4) DEFAULT 1.0000;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS away_attack NUMERIC(6, 4) DEFAULT 1.0000;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS away_defense NUMERIC(6, 4) DEFAULT 1.0000;
