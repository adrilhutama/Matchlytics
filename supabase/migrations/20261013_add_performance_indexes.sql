-- ============================================================
-- Migration 20261013: Performance Indexes
-- ============================================================
-- Optimizes common query patterns for the analytics pipeline
-- and frontend feed rendering.
-- ============================================================

-- 1. Competition + date range queries (filter by league, sort by kickoff)
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_date
    ON public.fixtures (competition_code, kickoff_time ASC)
    WHERE status IN ('NS', 'SCHEDULED', 'TIMED');

-- 2. EV scanner sort by descending edge value
CREATE INDEX IF NOT EXISTS idx_fixtures_ev_desc
    ON public.fixtures (ev_percentage DESC NULLS LAST)
    WHERE value_pick IS NOT NULL;

-- 3. Head-to-head lookup: all matches between two teams ordered by date
CREATE INDEX IF NOT EXISTS idx_fixtures_h2h_lookup
    ON public.fixtures (home_team_id, away_team_id, kickoff_time DESC)
    WHERE status IN ('NS', 'SCHEDULED', 'FT', 'FINISHED');

-- 4. Settlement tracking: find finished matches for evaluator
CREATE INDEX IF NOT EXISTS idx_fixtures_settlement
    ON public.fixtures (kickoff_time ASC)
    WHERE status IN ('FT', 'FINISHED', 'AET', 'PEN');

-- 5. Upcoming feed: most common query pattern (active fixtures ordered by time)
CREATE INDEX IF NOT EXISTS idx_fixtures_active_feed
    ON public.fixtures (kickoff_time ASC)
    WHERE status IN ('NS', 'SCHEDULED', 'TIMED');

-- 6. Team standings composite for quick lookups
CREATE INDEX IF NOT EXISTS idx_standings_league_team
    ON public.team_standings (league_code, team_id);

-- 7. Notifications: filter by user and read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.user_notifications (user_id, read ASC, created_at DESC);
