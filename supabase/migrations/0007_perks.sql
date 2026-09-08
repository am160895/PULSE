-- Finishes migration 0004, which turned out to be far more incompletely applied than
-- 0006 assumed: 0006 only fixed founding_scout_config/claim_founding_scout_slot, but a
-- live check afterward found the badge_code enum was NEVER extended with 'FOUNDING_SCOUT'
-- and user_badges never got its sequence_number column either — meaning every real
-- Founding Scout award attempt since launch has been silently failing at the very last
-- step (after the slot-claim function already incremented the counter), and the
-- FOUNDING_SCOUT badge has never once been successfully awarded to anyone despite the
-- counter showing several claimed slots. Both statements are copied verbatim from 0004.
alter type badge_code add value if not exists 'FOUNDING_SCOUT';
alter table user_badges add column if not exists sequence_number int;

-- ---------------------------------------------------------------------------

-- Perks framework: XP unlocking real status/utility rather than being purely decorative.
-- No contributor_level_name enum — this app never stores a "level" anywhere (it's always
-- derived from raw XP via lib/gamification/levels.ts's levelForXp), so perks store a plain
-- XP threshold instead of introducing a second, driftable source of truth for level
-- thresholds. Redemption is self-service (a user marks their own eligible perk as used),
-- not admin-recorded — there's no admin user-lookup tool in this app that would make an
-- admin-recorded flow practical, and the only real requirement (spec: "prevent repeated
-- redemption") is enforced by the unique constraint below regardless of who inserts it.

create table if not exists perks (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues (id) on delete cascade, -- null = citywide/PULSE-controlled
  title text not null,
  description text not null,
  required_min_xp int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null
);
create index if not exists perks_venue_idx on perks (venue_id);

alter table perks enable row level security;
drop policy if exists perks_public_read on perks;
create policy perks_public_read on perks for select using (is_active);
-- No insert/update/delete policy — admin routes write via supabaseAdmin(), same convention
-- as venues/founding_scout_config.

create table if not exists perk_redemptions (
  id uuid primary key default uuid_generate_v4(),
  perk_id uuid not null references perks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (perk_id, user_id) -- one redemption per user per perk, enforced at the DB level
);
create index if not exists perk_redemptions_user_idx on perk_redemptions (user_id);

alter table perk_redemptions enable row level security;
drop policy if exists perk_redemptions_self_read on perk_redemptions;
create policy perk_redemptions_self_read on perk_redemptions for select
  using (user_id in (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists perk_redemptions_self_insert on perk_redemptions;
create policy perk_redemptions_self_insert on perk_redemptions for insert
  with check (user_id in (select id from profiles where auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------

-- Analytics — deliberately last and fully self-contained inside one exception-guarded
-- block, so nothing here can ever block the two sections above (which matter much more).
-- The first version of this file assumed analytics_event_name (the enum from 0004) already
-- existed and just needed 'PERK_REDEEMED' added — that failed with a real Postgres error
-- ("type analytics_event_name does not exist"), meaning 0004's analytics half was never
-- actually applied either, despite analytics_events looking queryable through the app at
-- various points (almost certainly a stale PostgREST schema-cache read, not a real table).
-- This creates whatever's missing (type, then table) and adds the new value — safe to run
-- no matter which partial state turns out to be true, and analytics is best-effort by its
-- own design (see lib/data/analytics.ts) — never worth failing this migration over.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'analytics_event_name') then
    create type analytics_event_name as enum (
      'LANDING_VIEW', 'MAP_VIEW', 'VENUE_VIEW', 'SHARED_LINK_OPENED',
      'AUTH_STARTED', 'AUTH_COMPLETED',
      'REPORT_STARTED', 'REPORT_COMPLETED', 'IM_HERE_COMPLETED',
      'VENUE_SHARED', 'VENUE_SAVED', 'DIRECTIONS_CLICKED', 'FRIEND_INVITED'
    );
  end if;

  if not exists (select 1 from information_schema.tables where table_name = 'analytics_events') then
    create table analytics_events (
      id uuid primary key default uuid_generate_v4(),
      event analytics_event_name not null,
      profile_id uuid references profiles (id) on delete set null,
      venue_id uuid references venues (id) on delete set null,
      created_at timestamptz not null default now()
    );
    create index analytics_events_event_created_idx on analytics_events (event, created_at desc);
    alter table analytics_events enable row level security;
  end if;
exception when others then
  raise notice 'Analytics setup skipped (non-fatal): %', sqlerrm;
end $$;

alter type analytics_event_name add value if not exists 'PERK_REDEEMED';
