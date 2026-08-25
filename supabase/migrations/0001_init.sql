-- PULSE production schema (Supabase / Postgres).
-- This is the source of truth for a real deployment. The app runs today against a
-- local in-memory dev layer (src/lib/data) that implements the same repository
-- interface — see IMPLEMENTATION_PLAN.md for why, and supabase/README.md for how
-- to point the app at a real Supabase project once one exists.

create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists btree_gist; -- needed for the exclusion constraint below

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type user_role as enum ('USER', 'ADMIN');

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  home_city text not null default 'New York City',
  interests text[] not null default '{}',
  role user_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_auth_user_id_idx on profiles (auth_user_id);

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

create type venue_type as enum (
  'BAR', 'CLUB', 'LOUNGE', 'ROOFTOP', 'RESTAURANT', 'LIVE_MUSIC', 'CAFE', 'EVENT_SPACE', 'OTHER'
);

-- Set only when external_place_id came from Google Places; null for seed/admin-entered venues.
create type business_status as enum ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY');

-- Scaffolding for the future PULSE for Venues claim flow — not yet backed by any UI.
create type venue_claim_status as enum ('UNCLAIMED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

create table venues (
  id uuid primary key default uuid_generate_v4(),
  external_place_id text,
  name text not null,
  slug text not null unique,
  category text not null,
  subcategory text,
  venue_type venue_type not null,
  neighborhood text not null,
  street_address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  latitude double precision not null,
  longitude double precision not null,
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  timezone text not null default 'America/New_York',
  website text,
  instagram_handle text,
  capacity_estimate int,
  price_level smallint not null default 2 check (price_level between 1 and 4),
  music_type text,
  is_active boolean not null default true,
  business_status business_status,
  -- Google's rating/count are factual third-party context, kept deliberately separate from
  -- anything PULSE computes — never blended into pulse_score.
  external_rating real,
  external_rating_count int,
  claim_status venue_claim_status not null default 'UNCLAIMED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index venues_location_idx on venues using gist (location);
create index venues_venue_type_idx on venues (venue_type);
create index venues_neighborhood_idx on venues (neighborhood);
create index venues_is_active_idx on venues (is_active);

create table venue_hours (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null
);

create index venue_hours_venue_id_idx on venue_hours (venue_id);

create table venue_events (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  event_type text not null,
  source text not null default 'MANUAL',
  external_url text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index venue_events_venue_id_idx on venue_events (venue_id);
create index venue_events_starts_at_idx on venue_events (starts_at);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

create type crowd_level as enum ('EMPTY', 'QUIET', 'MODERATE', 'BUSY', 'PACKED');
create type wait_level as enum ('NONE', 'SHORT', 'MEDIUM', 'LONG', 'VERY_LONG');
create type energy_level as enum ('LOW', 'CHILL', 'GOOD', 'HIGH', 'VERY_HIGH');
create type report_source as enum ('APP', 'SIMULATOR');

create table venue_reports (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  crowd_level crowd_level not null,
  wait_level wait_level not null,
  energy_level energy_level not null,
  crowd_note varchar(100),
  report_source report_source not null default 'APP',
  -- Proximity is verified at submission time and reduced to a boolean. The raw
  -- coordinate used to verify it is never persisted here — see IMPLEMENTATION_PLAN.md.
  is_verified_nearby boolean not null default false,
  trust_weight_at_submission real not null default 0.5,
  created_at timestamptz not null default now(),
  -- Set by venue_reports_set_cooldown_window below, not by the app. A GiST exclusion
  -- constraint's indexed expression must be IMMUTABLE, but `created_at + interval` uses
  -- timestamptz_pl_interval, which Postgres marks STABLE (timezone-dependent in general,
  -- even though this particular interval is only minutes) — so the range can't be computed
  -- inline in the constraint itself. Materializing it via a plain trigger-set column sidesteps
  -- the restriction entirely, since ordinary column values carry no immutability requirement.
  cooldown_window tstzrange not null default tstzrange(now(), now())
);

create index venue_reports_venue_id_created_at_idx on venue_reports (venue_id, created_at desc);
create index venue_reports_user_id_venue_id_idx on venue_reports (user_id, venue_id, created_at desc);

create or replace function set_report_cooldown_window() returns trigger as $$
begin
  new.cooldown_window = tstzrange(new.created_at, new.created_at + interval '25 minutes');
  return new;
end;
$$ language plpgsql;

create trigger venue_reports_set_cooldown_window before insert or update of created_at
  on venue_reports for each row execute function set_report_cooldown_window();

-- One report per user per venue per 25-minute cooldown, enforced at the DB level as a real
-- backstop matching REPORT_COOLDOWN_MINUTES (the app layer checks this first, with a
-- friendlier error) — a plain unique index can only dedupe an exact key, not exclude
-- overlapping time ranges, so this needs a GiST exclusion constraint instead.
alter table venue_reports add constraint venue_reports_cooldown_excl
  exclude using gist (
    user_id with =,
    venue_id with =,
    cooldown_window with &&
  );

create table report_flags (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references venue_reports (id) on delete cascade,
  flagged_by uuid not null references profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table user_trust_scores (
  user_id uuid primary key references profiles (id) on delete cascade,
  trust_score real not null default 0.5 check (trust_score between 0 and 1),
  reports_submitted int not null default 0,
  reports_confirmed int not null default 0,
  reports_flagged int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- signal snapshots & hourly baselines
-- ---------------------------------------------------------------------------

create type trend_direction as enum ('RISING_FAST', 'RISING', 'STABLE', 'FALLING', 'FALLING_FAST');

create table venue_signal_snapshots (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  captured_at timestamptz not null default now(),
  pulse_score smallint not null check (pulse_score between 0 and 100),
  confidence_score smallint not null check (confidence_score between 0 and 100),
  crowd_score real not null,
  trend_score real not null,
  report_score real not null,
  historical_score real not null,
  event_score real not null,
  friend_activity_score real not null,
  trend_direction trend_direction not null,
  wait_min_minutes int,
  wait_max_minutes int,
  expected_peak_start timestamptz,
  expected_peak_end timestamptz,
  signal_version int not null default 1
);

create index venue_signal_snapshots_venue_id_captured_at_idx on venue_signal_snapshots (venue_id, captured_at desc);

create table venue_hourly_baselines (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  expected_activity_score real not null,
  expected_wait_score real not null,
  sample_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (venue_id, day_of_week, hour_of_day)
);

-- ---------------------------------------------------------------------------
-- friendships, presence, saved venues
-- ---------------------------------------------------------------------------

create type friendship_status as enum ('PENDING', 'ACCEPTED', 'BLOCKED');

create table friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status friendship_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create index friendships_addressee_id_idx on friendships (addressee_id);

-- A plain unique(requester_id, addressee_id) only stops an exact duplicate direction — it
-- would still allow a (B,A) row to coexist alongside an existing (A,B) row (e.g. one
-- ACCEPTED, one BLOCKED). Indexing the pair in a fixed order regardless of who's the
-- requester enforces "at most one relationship row per unordered pair of people."
create unique index friendships_unordered_pair_idx on friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

-- A user unilaterally tags another as a "close friend" for CLOSE_FRIENDS-tier presence.
create table close_friends (
  owner_id uuid not null references profiles (id) on delete cascade,
  friend_profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_profile_id)
);

create type visibility as enum ('PRIVATE', 'FRIENDS', 'CLOSE_FRIENDS');
create type presence_status as enum ('AT_VENUE', 'HEADING_THERE', 'NEARBY', 'RECENTLY_HERE');

create table presence_preferences (
  user_id uuid primary key references profiles (id) on delete cascade,
  default_visibility visibility not null default 'PRIVATE',
  allow_venue_presence boolean not null default false,
  allow_nearby_presence boolean not null default false,
  allow_recent_presence boolean not null default false,
  presence_timeout_minutes int not null default 120,
  updated_at timestamptz not null default now()
);

create table presence_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  status presence_status not null,
  visibility visibility not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > started_at)
);

create index presence_events_user_id_idx on presence_events (user_id);
create index presence_events_venue_id_expires_at_idx on presence_events (venue_id, expires_at);

create table saved_venues (
  user_id uuid not null references profiles (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger venues_set_updated_at before update on venues for each row execute function set_updated_at();
create trigger friendships_set_updated_at before update on friendships for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table venues enable row level security;
alter table venue_hours enable row level security;
alter table venue_events enable row level security;
alter table venue_reports enable row level security;
alter table report_flags enable row level security;
alter table user_trust_scores enable row level security;
alter table venue_signal_snapshots enable row level security;
alter table venue_hourly_baselines enable row level security;
alter table friendships enable row level security;
alter table close_friends enable row level security;
alter table presence_preferences enable row level security;
alter table presence_events enable row level security;
alter table saved_venues enable row level security;

-- RLS on close_friends only lets a session see rows it OWNS. But checking "did the
-- presence owner tag the viewer as a close friend" needs the opposite direction (queried
-- as the viewer, filtering on someone else's owner_id) — a plain subquery from another
-- policy is still subject to close_friends' own RLS, so it would silently return zero
-- rows for anyone but the owner and CLOSE_FRIENDS presence would never be visible to an
-- actual friend. A SECURITY DEFINER function is the standard fix: it runs with the
-- privileges of its owner (bypassing RLS) but only ever answers this one narrow,
-- non-sensitive boolean question, so it can't be used to exfiltrate the table.
-- Defined here, before any policy, because policies below reference it by name and
-- Postgres resolves that reference at CREATE POLICY time, not lazily at query time.
create or replace function is_close_friend(owner uuid, friend uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from close_friends where owner_id = owner and friend_profile_id = friend
  );
$$;

-- profiles has a public-read policy, so this doesn't strictly need SECURITY DEFINER to
-- avoid the close_friends-style recursion problem — kept as a plain function for reuse
-- across every admin-only write policy below rather than repeating the subquery. Also
-- defined here, ahead of the policies that use it, for the same reason as is_close_friend.
create or replace function is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles where auth_user_id = auth.uid() and role = 'ADMIN'
  );
$$;

-- Venues and their static/derived data are public read (it's a discovery map, not
-- private data). The admin panel's API routes write through the service role (bypasses
-- RLS entirely, same as every other server-side write in this app) — these admin write
-- policies are defense-in-depth for the case an authenticated (non-service-role) session
-- ever touches these tables directly, not the primary enforcement mechanism.
create policy venues_public_read on venues for select using (true);
create policy venues_admin_write on venues for insert with check (is_admin());
create policy venues_admin_update on venues for update using (is_admin());
create policy venues_admin_delete on venues for delete using (is_admin());

create policy venue_hours_public_read on venue_hours for select using (true);
create policy venue_hours_admin_write on venue_hours for all using (is_admin());

create policy venue_events_public_read on venue_events for select using (true);
create policy venue_events_admin_write on venue_events for all using (is_admin());

create policy venue_signal_snapshots_public_read on venue_signal_snapshots for select using (true);
create policy venue_hourly_baselines_public_read on venue_hourly_baselines for select using (true);
create policy venue_hourly_baselines_admin_write on venue_hourly_baselines for all using (is_admin());

-- Profiles: anyone can read the public fields of any profile (needed to show friend
-- names/avatars); a user may only update their own row — except `role`, which only an
-- admin may change (see profiles_admin_update below; a self-update that also flips one's
-- own role to ADMIN would defeat the whole point of an admin role).
create policy profiles_public_read on profiles for select using (true);
create policy profiles_self_update on profiles for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and role = (select role from profiles p where p.auth_user_id = auth.uid()));
create policy profiles_self_insert on profiles for insert with check (auth_user_id = auth.uid() and role = 'USER');
create policy profiles_admin_update on profiles for update using (is_admin());

-- Reports: readable by anyone (they feed the public score), but a user may only
-- insert a report attributed to their own profile, and never edit/delete others'.
create policy venue_reports_public_read on venue_reports for select using (true);
-- Proximity verification and trust weighting are computed server-side (submitReport.ts) —
-- a direct client insert (bypassing that server path) must not be able to self-declare
-- verified proximity or an elevated trust weight, which would let a report count for more
-- than an honest unverified submission from a brand-new account.
create policy venue_reports_self_insert on venue_reports for insert
  with check (
    user_id in (select id from profiles where auth_user_id = auth.uid())
    and is_verified_nearby = false
    and trust_weight_at_submission = 0.5
    and report_source = 'APP'
  );

create policy report_flags_self_insert on report_flags for insert
  with check (flagged_by in (select id from profiles where auth_user_id = auth.uid()));

-- Trust scores are never exposed to clients at all (no select policy = no client access;
-- only the service role, which bypasses RLS, can read/write these).

-- Friendships: a user may see and act on rows where they're a participant.
create policy friendships_participant_read on friendships for select
  using (
    requester_id in (select id from profiles where auth_user_id = auth.uid())
    or addressee_id in (select id from profiles where auth_user_id = auth.uid())
  );
create policy friendships_requester_insert on friendships for insert
  with check (requester_id in (select id from profiles where auth_user_id = auth.uid()));
create policy friendships_participant_update on friendships for update
  using (
    requester_id in (select id from profiles where auth_user_id = auth.uid())
    or addressee_id in (select id from profiles where auth_user_id = auth.uid())
  )
  with check (
    -- Only the addressee can move a row into ACCEPTED — the requester must not be able
    -- to self-accept their own outgoing friend request. Either participant may BLOCK.
    status <> 'ACCEPTED' or addressee_id in (select id from profiles where auth_user_id = auth.uid())
  );

create policy close_friends_owner_all on close_friends for all
  using (owner_id in (select id from profiles where auth_user_id = auth.uid()));

-- Presence preferences: only the owner can read or write their own settings.
create policy presence_preferences_owner_all on presence_preferences for all
  using (user_id in (select id from profiles where auth_user_id = auth.uid()));

-- Presence events: this is the most privacy-sensitive table. RLS enforces that a row
-- is only selectable by (a) its owner, or (b) an ACCEPTED friend when visibility allows
-- it and it hasn't expired — mirroring src/lib/presence/visibility.ts exactly, so the
-- app-layer check and the DB-layer check agree.
create policy presence_events_owner_all on presence_events for all
  using (user_id in (select id from profiles where auth_user_id = auth.uid()));

create policy presence_events_friend_read on presence_events for select
  using (
    expires_at > now()
    and visibility in ('FRIENDS', 'CLOSE_FRIENDS')
    and exists (
      select 1 from friendships f
      join profiles viewer on viewer.auth_user_id = auth.uid()
      where f.status = 'ACCEPTED'
        and (
          (f.requester_id = viewer.id and f.addressee_id = presence_events.user_id)
          or (f.addressee_id = viewer.id and f.requester_id = presence_events.user_id)
        )
    )
    and (
      visibility = 'FRIENDS'
      or is_close_friend(
        presence_events.user_id,
        (select id from profiles where auth_user_id = auth.uid())
      )
    )
  );

-- Saved venues: owner only.
create policy saved_venues_owner_all on saved_venues for all
  using (user_id in (select id from profiles where auth_user_id = auth.uid()));
