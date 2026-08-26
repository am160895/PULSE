-- PULSE historical memory + owner portal schema.
-- Bundles two unrelated features in one migration, matching 0002's own precedent:
-- venue_owners sits unused until the owner portal code lands (same as claim_status sat
-- unused from 0001 until this migration finally gives it a real write path).

-- ---------------------------------------------------------------------------
-- historical memory: one row per venue per completed nightlife-night
-- ---------------------------------------------------------------------------
-- venue_signal_snapshots is deliberately pruned after 12 hours (see appendSnapshot /
-- appendSnapshotsBatch) — nothing survives to become real history. This table is the
-- archive point. Written only by the request-triggered, idempotent compute-on-read path
-- in src/lib/pulse/history/nightlyRollup.ts (no cron infra exists in this app).

create table venue_nightly_rollups (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  nightlife_date date not null, -- venue-LOCAL date the night belongs to (see nightlifeDayParts)
  nightlife_day_of_week smallint not null check (nightlife_day_of_week between 0 and 6),
  avg_pulse_score real not null,
  peak_pulse_score smallint not null check (peak_pulse_score between 0 and 100),
  peak_at timestamptz,
  sample_count int not null default 0,
  report_count int not null default 0,
  computed_at timestamptz not null default now(),
  unique (venue_id, nightlife_date)
);

create index venue_nightly_rollups_venue_dow_idx on venue_nightly_rollups (venue_id, nightlife_day_of_week, nightlife_date desc);

alter table venue_nightly_rollups enable row level security;
create policy venue_nightly_rollups_public_read on venue_nightly_rollups for select using (true);
-- No insert/update policy — only supabaseAdmin() ever writes this, same as venue_signal_snapshots.

-- ---------------------------------------------------------------------------
-- owner portal: venue ownership as a join table (a person can own multiple venues; a
-- 1:1 role flip on profiles couldn't express that, and every owner route needs to know
-- WHICH venue(s) regardless of a role check)
-- ---------------------------------------------------------------------------

create type venue_owner_status as enum ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

create table venue_owners (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  status venue_owner_status not null default 'PENDING',
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, profile_id)
);

create index venue_owners_profile_id_idx on venue_owners (profile_id);
create index venue_owners_venue_id_status_idx on venue_owners (venue_id, status);
create trigger venue_owners_set_updated_at before update on venue_owners for each row execute function set_updated_at();

alter table venue_owners enable row level security;
create policy venue_owners_self_read on venue_owners for select
  using (profile_id in (select id from profiles where auth_user_id = auth.uid()));
create policy venue_owners_admin_read on venue_owners for select using (is_admin());
-- A self-insert can only ever land as PENDING — nobody can self-grant VERIFIED, even by
-- bypassing the app layer and calling this table directly. Real writes go through
-- supabaseAdmin() (bypassing RLS) via the app's own claim route, same as every other
-- primary write path in this app — this policy is the defense-in-depth backstop.
create policy venue_owners_self_insert on venue_owners for insert
  with check (profile_id in (select id from profiles where auth_user_id = auth.uid()) and status = 'PENDING');
-- No self-update policy at all — only an admin can move a row to VERIFIED/REJECTED/REVOKED.
create policy venue_owners_admin_write on venue_owners for update using (is_admin());
