-- ============================================================
-- Matchlytics Migration 20261008: Full Free Tier Competitions
-- Seeds all 12 football-data.org Free Tier competitions into
-- public.competitions to satisfy foreign key constraints
-- and provide a single source of truth for league metadata.
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

-- 1. Create competitions table
CREATE TABLE IF NOT EXISTS public.competitions (
    id          INT PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    country     TEXT,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_code ON public.competitions(code);
CREATE INDEX IF NOT EXISTS idx_competitions_country ON public.competitions(country);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.competitions TO anon;
GRANT SELECT ON public.competitions TO authenticated;

CREATE POLICY "Anyone can read competitions"
    ON public.competitions
    FOR SELECT
    USING (true);

-- 2. Seed all 12 Free Tier competitions
INSERT INTO public.competitions (id, code, name, country)
VALUES
    (2000, 'WC',  'FIFA World Cup',            'World'),
    (2001, 'CL',  'UEFA Champions League',     'Europe'),
    (2002, 'BL1', 'Bundesliga',                'Germany'),
    (2003, 'DED', 'Eredivisie',                'Netherlands'),
    (2013, 'BSA', 'Campeonato Brasileiro Serie A', 'Brazil'),
    (2014, 'PD',  'La Liga',                   'Spain'),
    (2015, 'FL1', 'Ligue 1',                   'France'),
    (2016, 'ELC', 'Championship',              'England'),
    (2017, 'PPL', 'Primeira Liga',             'Portugal'),
    (2018, 'EC',  'European Championship',     'Europe'),
    (2019, 'SA',  'Serie A',                   'Italy'),
    (2021, 'PL',  'Premier League',            'England')
ON CONFLICT (code) DO UPDATE
SET
    id           = EXCLUDED.id,
    name         = EXCLUDED.name,
    country      = EXCLUDED.country,
    updated_at   = NOW();

-- 3. Verify seed
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.competitions;
    RAISE NOTICE 'Competitions seeded: %', v_count;
END $$;
