-- ============================================================
-- Matchlytics Migration 20261003: Multi-Market Odds & EV Storage
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS market_odds JSONB;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS ev_opportunities JSONB;

COMMENT ON COLUMN public.fixtures.market_odds IS 'Structured bookmaker multi-market odds (1X2, totals, spreads, no-vig).';
COMMENT ON COLUMN public.fixtures.ev_opportunities IS 'Detected +EV value opportunities across all markets.';
