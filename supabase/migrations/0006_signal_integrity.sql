-- Signal-integrity pass: no new tables for SignalHealth/contributor-dedup (the existing
-- 25-minute venue_reports cooldown constraint plus in-memory recomputation cover that —
-- see src/lib/pulse/signalHealth.ts). This migration exists for exactly one thing:
-- finishing 0004_founding_scout_and_analytics.sql, which was only partially applied to
-- the live database — analytics_events exists live, but founding_scout_config and
-- claim_founding_scout_slot() do not (confirmed via a direct read check against
-- production). Any Founding Scout award attempt currently fails or silently no-ops.
-- Written with if-not-exists/create-or-replace throughout so it's safe to run regardless
-- of exactly which parts of 0004 did or didn't land.

create table if not exists founding_scout_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  max_count int not null default 100,
  awarded_count int not null default 0
);
insert into founding_scout_config (id) values (true) on conflict (id) do nothing;

alter table founding_scout_config enable row level security;
drop policy if exists founding_scout_config_public_read on founding_scout_config;
create policy founding_scout_config_public_read on founding_scout_config for select using (true);

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
