-- ============================================================
-- Matchlytics Migration 20261008: Full Free Tier Competitions
-- Seeds all 12 football-data.org Free Tier competitions into
-- public.competitions to satisfy foreign key constraints
-- and provide a single source of truth for league metadata.
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

-- 1. Create competitions table with id and odds_api_sport_key
CREATE TABLE IF NOT EXISTS public.competitions (
    id                  INT,
    code                TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    country             TEXT,
    logo_url            TEXT,
    odds_api_sport_key  TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure primary key exists (id column)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'competitions_pkey'
    ) THEN
        ALTER TABLE public.competitions ADD PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competitions_code ON public.competitions(code);
CREATE INDEX IF NOT EXISTS idx_competitions_country ON public.competitions(country);
CREATE INDEX IF NOT EXISTS idx_competitions_sport_key ON public.competitions(odds_api_sport_key);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.competitions TO anon;
GRANT SELECT ON public.competitions TO authenticated;

CREATE POLICY "Anyone can read competitions"
    ON public.competitions
    FOR SELECT
    USING (true);

-- 3. Seed all 12 Free Tier competitions with sport keys
INSERT INTO public.competitions (id, code, name, country, odds_api_sport_key)
VALUES
    (2000, 'WC',  'FIFA World Cup',                   'World',          'soccer_fifa_world_cup'),
    (2001, 'CL',  'UEFA Champions League',            'Europe',         'soccer_uefa_champs_league'),
    (2002, 'BL1', 'Bundesliga',                       'Germany',        'soccer_germany_bundesliga'),
    (2003, 'DED', 'Eredivisie',                       'Netherlands',    'soccer_netherlands_eredivisie'),
    (2013, 'BSA', 'Campeonato Brasileiro Serie A',    'Brazil',         'soccer_brazil_campeonato'),
    (2014, 'PD',  'La Liga',                          'Spain',          'soccer_spain_la_liga'),
    (2015, 'FL1', 'Ligue 1',                          'France',         'soccer_france_ligue_one'),
    (2016, 'ELC', 'Championship',                     'England',        'soccer_efl_champ'),
    (2017, 'PPL', 'Primeira Liga',                    'Portugal',       'soccer_portugal_primeira_liga'),
    (2018, 'EC',  'European Championship',            'Europe',         'soccer_uefa_european_championship'),
    (2019, 'SA',  'Serie A',                          'Italy',          'soccer_italy_serie_a'),
    (2021, 'PL',  'Premier League',                   'England',        'soccer_epl')
ON CONFLICT (code) DO UPDATE
SET
    id                   = EXCLUDED.id,
    name                 = EXCLUDED.name,
    country              = EXCLUDED.country,
    odds_api_sport_key   = EXCLUDED.odds_api_sport_key,
    updated_at           = NOW();

-- 4. Verify seed
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count FROM public.competitions;
    RAISE NOTICE 'Competitions seeded: %', v_count;
END $$;
