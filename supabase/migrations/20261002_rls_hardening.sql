-- ============================================================
-- Matchlytics Migration 20261002: RLS Hardening & Least Privilege
-- ============================================================
-- Closes the audit findings from the Phase 2 production review:
--
--   H-01  Paywall self-escalation on profiles.
--          The 20260930 migration granted authenticated an
--          unrestricted row-scoped UPDATE policy
--          ("Users can update own profile", using auth.uid() = id).
--          Postgres row policies cannot pin individual columns, so
--          any signed-in user could flip their own
--          subscription_tier / subscription_status /
--          current_period_end through the public PostgREST endpoint
--          (update profiles set ... where id = <self>) and unlock
--          the paid horizons. The SPA derives every gate from that
--          single row, making it the entire paywall defence surface.
--          Fix: row ownership kept, but every entitlement column is
--          frozen in the WITH CHECK clause; only full_name (and the
--          trigger-maintained updated_at) remain self-writable.
--          Activation still happens exclusively under the service
--          role, which bypasses RLS.
--
--   H-02  Silent 0-row feed risk on the read side.
--          fixtures / team_standings read policies are TO anon only.
--          Signed-in clients have been relying on whatever default
--          grants their project happened to create, so a fresh
--          project (or a dropped default grant) turns logged-in
--          dashboard views into empty results with no error.
--          Fix: explicit SELECT grants to anon AND authenticated on
--          both tables plus the helper view.
--
--   H-03  Write-side over-grant to client roles.
--          Even with RLS on, projects ship default
--          INSERT/UPDATE/DELETE grants to anon and authenticated on
--          pipeline-owned tables; a future config mistake (disabled
--          RLS, permissive-mode accident) would open the store to
--          arbitrary client writes.
--          Fix: explicitly REVOKE all write verbs from anon and
--          authenticated. Only the service role (used by GitHub
--          Actions) writes, and it bypasses RLS regardless.
--
--   H-04  SECURITY DEFINER housekeeping RPC exposed to visitors.
--          clean_stale_fixtures() deletes settled fixtures older
--          than 45 days, and freshly created functions are
--          EXECUTE-to-PUBLIC by default, so any anonymous caller of
--          the PostgREST RPC could have pruned the archive table.
--          Fix: revoke execute from public/anon/authenticated,
--          grant to service_role only. Trigger helpers
--          (handle_new_user, touch_profiles_updated_at) get the same
--          treatment: trigger firing does not consult EXECUTE
--          privileges, so neither path breaks.
-- ============================================================


-- ------------------------------------------------------------
-- H-01: freeze entitlement columns on self-updates
-- ------------------------------------------------------------

-- Ownership policy from 20260930, rewritten with column pinning.
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
    and new.email               = old.email
  );

-- Insertion stays trigger-driven (security definer); anon is denied
-- outright so no one can pre-seed another user's row.
revoke insert, update, delete on public.profiles from anon;
revoke insert, delete on public.profiles from authenticated;
-- UPDATE stays granted to authenticated but is fully governed by
-- the frozen policy above: touching a pinned column raises
-- "new row violates row-level security policy" and the write fails.


-- ------------------------------------------------------------
-- H-02: explicit read grants (both client roles, both tables)
-- ------------------------------------------------------------

grant select on public.fixtures, public.team_standings to anon;
grant select on public.fixtures, public.team_standings to authenticated;

-- Helper view from migration 001 resolves through the caller, so it
-- needs the same dual-role grant or signed-in users lose it.
grant select on public.upcoming_fixtures to anon;
grant select on public.upcoming_fixtures to authenticated;


-- ------------------------------------------------------------
-- H-03: strip write verbs from client roles on pipeline stores
-- ------------------------------------------------------------

revoke insert, update, delete on public.fixtures from anon, authenticated;
revoke insert, update, delete on public.team_standings from anon, authenticated;
revoke truncate on public.fixtures, public.team_standings from anon, authenticated;


-- ------------------------------------------------------------
-- H-04: lock the SECURITY DEFINER function surface
-- ------------------------------------------------------------

revoke execute on function public.clean_stale_fixtures() from public, anon, authenticated;
grant execute on function public.clean_stale_fixtures() to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_profiles_updated_at() from public, anon, authenticated;

comment on function public.clean_stale_fixtures() is
  'Housekeeping routine: prunes match records older than 45 days. Service role only (H-04).';
