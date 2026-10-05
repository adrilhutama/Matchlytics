-- ============================================================
-- Matchlytics Migration 20261007: Database Audit Remediations
-- Addresses findings from full schema security audit.
-- Zero em dash characters used (R-02 compliance).
-- ============================================================

-- ------------------------------------------------------------
-- FIX-01: user_notifications RLS grants
-- ------------------------------------------------------------
-- The notification table has SELECT policies but no explicit
-- GRANT to anon/authenticated roles. This blocks all client reads.

grant select on public.user_notifications to anon;
grant select on public.user_notifications to authenticated;

grant insert, update on public.user_notifications to service_role;


-- ------------------------------------------------------------
-- FIX-02: admin_audit_log policy hardening
-- ------------------------------------------------------------
-- Add is_admin flag to profiles for server-side admin checks.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Drop overly permissive audit log policy
drop policy if exists "Admins can read audit log" on public.admin_audit_log;

-- Restrict audit log reads to admins only
create policy "Only admins can read audit log"
  on public.admin_audit_log
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.is_admin = true
    )
  );

-- Service role retains write access for Edge Function
create policy "Service role writes audit log"
  on public.admin_audit_log
  for insert
  to service_role
  with check (true);


-- ------------------------------------------------------------
-- FIX-03: Fix user_notifications.fixture_id type mismatch
-- ------------------------------------------------------------
-- fixtures.id is BIGINT but user_notifications.fixture_id was
-- created as UUID. Convert to BIGINT and recreate FK.

alter table public.user_notifications
  drop constraint if exists user_notifications_fixture_id_fkey;

alter table public.user_notifications
  alter column fixture_id type BIGINT
  using case
    when fixture_id is null then null
    else fixture_id::text::bigint
  end;

alter table public.user_notifications
  add constraint user_notifications_fixture_id_fkey
    foreign key (fixture_id)
    references public.fixtures(id)
    on delete set null;


-- ------------------------------------------------------------
-- FIX-04: profiles UPDATE policy WITH CHECK hardening
-- ------------------------------------------------------------
-- Explicitly freeze entitlement columns on self-updates.

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile, entitlement columns frozen"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = new.id
    and new.subscription_tier  = old.subscription_tier
    and new.subscription_status = old.subscription_status
    and new.current_period_end  = old.current_period_end
    and new.is_admin            = old.is_admin
  );


-- ------------------------------------------------------------
-- FIX-05: Drop redundant fixture indexes
-- ------------------------------------------------------------
-- These are superseded by partial composite indexes in migration 002.

drop index if exists idx_fixtures_match_date;
drop index if exists idx_fixtures_status;


-- ------------------------------------------------------------
-- FIX-06: Add composite index for portfolio queries
-- ------------------------------------------------------------
-- Covers common pattern: WHERE user_id = ? AND status = ? ORDER BY created_at DESC

create index if not exists idx_portfolio_user_status_created
  on public.portfolio_positions (user_id, status, created_at DESC);


-- ------------------------------------------------------------
-- FIX-07: Add index for admin user lookup on profiles
-- ------------------------------------------------------------
-- Admin dashboard fetches profiles ordered by creation time.

create index if not exists idx_profiles_created
  on public.profiles (created_at DESC);
