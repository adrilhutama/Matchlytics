-- ============================================================
-- 20260930_create_profiles.sql
-- Authentication and subscription gating schema for Matchlytics.
--
-- Adds:
--   public.profiles       : one row per auth user, carrying
--                           subscription_tier / subscription_status
--                           used by the app-level paywall
--   handle_new_user()     : auto-provisions a free profile on signup
--   RLS + grants          : users read/update only their own row
--   realtime publication  : live subscription refresh inside the SPA
--
-- Operator note:
--   Payment fulfilment (Midtrans/Stripe webhook or manual admin action)
--   must run with the service role, which bypasses RLS:
--
--     update public.profiles
--        set subscription_status = 'active',
--            subscription_tier   = 'pro',
--            current_period_end  = now() + interval '30 days'
--      where id = '<user uuid>';
-- ============================================================

-- ------------------------------------------------------------
-- 1) Table
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  subscription_tier text not null default 'free',
  subscription_status text not null default 'inactive',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint profiles_tier_check
    check (subscription_tier in ('free', 'pro', 'institutional')),
  constraint profiles_status_check
    check (subscription_status in ('inactive', 'active', 'past_due'))
);

comment on table public.profiles is
  'User profiles and subscription state, one row per auth user.';

create index if not exists profiles_status_idx on public.profiles (subscription_status);

-- ------------------------------------------------------------
-- 2) Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Insertion happens through the security-definer trigger below;
-- activation requires the service role, which bypasses RLS.
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) Auto-create a free profile on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, subscription_tier, subscription_status)
  values (new.id, coalesce(new.email, ''), 'free', 'inactive')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: users who registered before this migration get a row too.
insert into public.profiles (id, email, subscription_tier, subscription_status)
select u.id, coalesce(u.email, ''), 'free', 'inactive'
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- ------------------------------------------------------------
-- 4) Keep updated_at current on every write
-- ------------------------------------------------------------
create or replace function public.touch_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_profiles_updated_at();

-- ------------------------------------------------------------
-- 5) Realtime: signed-in clients track their own subscription state
--    (row-level RLS limits each client to its own row)
-- ------------------------------------------------------------
alter table public.profiles replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Publication not present in this environment; realtime refresh
    -- degrades to manual refresh, the query side is unaffected.
    NULL;
END $$;
