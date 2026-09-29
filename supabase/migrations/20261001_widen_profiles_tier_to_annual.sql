-- 20261001_widen_profiles_tier_to_annual.sql
--
-- Adds 'annual' to the allowed subscription_tier values.
-- The 3-tier model (free / pro / annual, with institutional
-- behaving as annual) requires the season pass tier to be
-- storable on profiles rows; the original 20260930 migration
-- only admitted ('free','pro','institutional').
--
-- Drop + recreate keeps live data intact; no default changes.

alter table public.profiles
  drop constraint if exists profiles_tier_check;

alter table public.profiles
  add constraint profiles_tier_check
  check (subscription_tier in ('free', 'pro', 'annual', 'institutional'));
