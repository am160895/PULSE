-- PULSE gamification + opening-hours engine.
-- Adds: special-hours overrides (venue_hours gains freshness/closure columns; a new
-- venue_special_hours table for holidays/private events/late openings), and the full
-- event-ledger-based gamification system (XP, levels, neighborhood progression, badges).

-- ---------------------------------------------------------------------------
-- hours
-- ---------------------------------------------------------------------------

alter table venue_hours
  add column is_closed boolean not null default false,
  add column source text not null default 'SEED',
  add column last_verified_at timestamptz;

alter table venue_hours alter column open_time drop not null;
alter table venue_hours alter column close_time drop not null;

alter table venue_hours add constraint venue_hours_time_required_when_open
  check (is_closed or (open_time is not null and close_time is not null));

create type hours_source as enum ('SEED', 'ADMIN', 'VENUE_OWNER', 'GOOGLE_PLACES');

-- Safe to retype in place: the column is brand new above, every existing row defaults to
-- the literal 'SEED', which is a valid member of the enum being cast to.
alter table venue_hours alter column source drop default;
alter table venue_hours alter column source type hours_source using source::hours_source;
alter table venue_hours alter column source set default 'SEED';

create table venue_special_hours (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  special_date date not null, -- venue-LOCAL calendar date this override applies to
  is_closed boolean not null default false,
  open_time time,
  close_time time, -- may be < open_time: crosses midnight (e.g. a New Year's Eve window)
  reason text,
  source hours_source not null default 'ADMIN',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (is_closed or (open_time is not null and close_time is not null)),
  unique (venue_id, special_date)
);

create index venue_special_hours_venue_id_date_idx on venue_special_hours (venue_id, special_date);

alter table venue_special_hours enable row level security;
create policy venue_special_hours_public_read on venue_special_hours for select using (true);
create policy venue_special_hours_admin_write on venue_special_hours for all using (is_admin());

-- ---------------------------------------------------------------------------
-- gamification — event-ledger based (xp_events is the source of truth; user_progress /
-- user_neighborhood_progress are trigger-maintained running totals, never written directly)
-- ---------------------------------------------------------------------------

create type xp_reward_type as enum (
  'I_AM_HERE',
  'CROWD_REPORT',
  'WAIT_REPORT',
  'ENERGY_REPORT',
  'LIVE_NOTE',
  'FIRST_REPORT_TONIGHT',
  'SIGNAL_CONFIRMED',
  'VENUE_CORRECTION'
);

create table xp_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  reward_type xp_reward_type not null,
  xp_amount int not null check (xp_amount >= 0),
  -- Polymorphic, not an FK: a real venue_reports.id for report-shaped rewards, or a
  -- synthetic "presence:{userId}:{venueId}:{25min-bucket}" composite for I_AM_HERE, which
  -- has no row of its own. The unique index below does double duty: idempotent-retry
  -- protection for report XP, and the anti-farming cooldown for presence XP.
  source_id text not null,
  venue_id uuid references venues (id) on delete set null,
  neighborhood text, -- denormalized at award time, keeps the ledger self-contained
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index xp_events_idempotency_idx on xp_events (user_id, source_id, reward_type);
create index xp_events_user_id_created_at_idx on xp_events (user_id, created_at desc);
create index xp_events_venue_id_idx on xp_events (venue_id);

create table user_progress (
  user_id uuid primary key references profiles (id) on delete cascade,
  total_xp int not null default 0 check (total_xp >= 0),
  updated_at timestamptz not null default now()
);

create table user_neighborhood_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  neighborhood text not null,
  xp int not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, neighborhood)
);

create or replace function apply_xp_event() returns trigger as $$
begin
  insert into user_progress (user_id, total_xp, updated_at)
  values (new.user_id, new.xp_amount, now())
  on conflict (user_id) do update
    set total_xp = user_progress.total_xp + excluded.total_xp,
        updated_at = now();

  if new.neighborhood is not null then
    insert into user_neighborhood_progress (user_id, neighborhood, xp, updated_at)
    values (new.user_id, new.neighborhood, new.xp_amount, now())
    on conflict (user_id, neighborhood) do update
      set xp = user_neighborhood_progress.xp + excluded.xp,
          updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger xp_events_apply after insert on xp_events
  for each row execute function apply_xp_event();

create type badge_code as enum (
  'FIRST_SIGNAL', 'TREND_SPOTTER', 'LINE_SAVER', 'NIGHT_OWL',
  'ON_THE_PULSE', 'CITY_SCOUT', 'EARLY_SIGNAL', 'NEIGHBORHOOD_INSIDER'
);

create table badges (
  code badge_code primary key,
  name text not null,
  description text not null,
  motif text not null,
  sort_order smallint not null default 0
);

insert into badges (code, name, description, motif, sort_order) values
  ('FIRST_SIGNAL', 'First Signal', 'First verified useful report from a venue that evening.', 'radiating-dot', 1),
  ('TREND_SPOTTER', 'Trend Spotter', 'Called it early — your report was confirmed by the crowd that followed.', 'rising-line', 2),
  ('LINE_SAVER', 'Line Saver', 'Submitted multiple accurate wait-time reports.', 'minimal-clock', 3),
  ('NIGHT_OWL', 'Night Owl', 'Useful verified contribution after midnight.', 'abstract-moon', 4),
  ('ON_THE_PULSE', 'On the Pulse', 'Contributed on multiple nights out.', 'concentric-pulse', 5),
  ('CITY_SCOUT', 'City Scout', 'Useful contributions across multiple neighborhoods.', 'location-signal', 6),
  ('EARLY_SIGNAL', 'Early Signal', 'Reported meaningful activity before the crowd confirmed it.', 'radiating-dot', 7),
  ('NEIGHBORHOOD_INSIDER', 'Neighborhood Insider', 'Earned neighborhood contribution threshold.', 'location-signal', 8);

create table user_badges (
  user_id uuid not null references profiles (id) on delete cascade,
  badge_code badge_code not null references badges (code),
  -- '' sentinel (NOT NULL, never actual NULL) for non-neighborhood-scoped badges: Postgres
  -- never treats two NULLs as equal for uniqueness, so a nullable column here would allow
  -- duplicate awards of e.g. FIRST_SIGNAL. '' makes the primary key actually enforce
  -- "at most one award" for both scoped and unscoped badges.
  neighborhood text not null default '',
  awarded_at timestamptz not null default now(),
  xp_event_id uuid references xp_events (id) on delete set null,
  primary key (user_id, badge_code, neighborhood)
);

create index user_badges_user_id_idx on user_badges (user_id);

alter table xp_events enable row level security;
alter table user_progress enable row level security;
alter table user_neighborhood_progress enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;

-- xp_events is the raw ledger — venue-by-venue, timestamped, effectively a location
-- history. No select policy at all: service-role only, same treatment as user_trust_scores.
-- The aggregates below are the visible game mechanic (profile page, badges, share) — public read.
create policy user_progress_public_read on user_progress for select using (true);
create policy user_neighborhood_progress_public_read on user_neighborhood_progress for select using (true);
create policy badges_public_read on badges for select using (true);
create policy user_badges_public_read on user_badges for select using (true);
-- No insert/update policy on any of the five tables — every write goes through
-- supabaseAdmin() from src/lib/gamification/xp.ts, same convention as user_trust_scores.
