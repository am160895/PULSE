-- Founding Scout: a limited, sequentially-numbered badge for the first N users who make a
-- genuine contribution (not just sign up). Reuses the existing badge system rather than a
-- parallel one — just adds a new badge_code + an optional sequence number.
alter type badge_code add value if not exists 'FOUNDING_SCOUT';

alter table user_badges add column if not exists sequence_number int;

-- Singleton config row (id fixed to true so there's only ever one) — lets an admin
-- pause/resume the program or raise the cap without a code change/deploy.
create table if not exists founding_scout_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  max_count int not null default 100,
  awarded_count int not null default 0
);
insert into founding_scout_config (id) values (true) on conflict (id) do nothing;

alter table founding_scout_config enable row level security;
create policy founding_scout_config_public_read on founding_scout_config for select using (true);
-- No insert/update policy — only supabaseAdmin() writes this, same as every other
-- service-role-only table in this app.

-- supabase-js's query builder has no way to express "column = column + 1 where ... returning
-- column" atomically — a read-then-write from application code would race under concurrent
-- signups (two requests could both read awarded_count=99 and both think they got slot #100).
-- A single-statement SQL function is the standard fix; called only via supabaseAdmin(), same
-- as every other service-role-only write in this app, so no SECURITY DEFINER is needed.
create or replace function claim_founding_scout_slot() returns int
language plpgsql as $$
declare
  next_seq int;
begin
  update founding_scout_config
    set awarded_count = awarded_count + 1
    where id = true and enabled and awarded_count < max_count
    returning awarded_count into next_seq;
  return next_seq; -- null if the program is disabled or full
end;
$$;

-- ---------------------------------------------------------------------------

-- Privacy-respecting funnel analytics: named events only, no free-text/location payloads.
-- profile_id is nullable — an anonymous browsing session still needs to be counted in the
-- funnel (MAP_VIEW, VENUE_VIEW) before it ever has a real signup to attach to.
create type analytics_event_name as enum (
  'LANDING_VIEW', 'MAP_VIEW', 'VENUE_VIEW', 'SHARED_LINK_OPENED',
  'AUTH_STARTED', 'AUTH_COMPLETED',
  'REPORT_STARTED', 'REPORT_COMPLETED', 'IM_HERE_COMPLETED',
  'VENUE_SHARED', 'VENUE_SAVED', 'DIRECTIONS_CLICKED', 'FRIEND_INVITED'
);

create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  event analytics_event_name not null,
  profile_id uuid references profiles (id) on delete set null,
  venue_id uuid references venues (id) on delete set null,
  created_at timestamptz not null default now()
);
create index analytics_events_event_created_idx on analytics_events (event, created_at desc);

alter table analytics_events enable row level security;
-- No read or write policy at all — this table is written by supabaseAdmin() only and read
-- only via the admin funnel dashboard (also supabaseAdmin()); it's never queried from the
-- browser's own Supabase client, so there's nothing for RLS to actually gate here, same
-- reasoning as every other service-role-only table in this app.
