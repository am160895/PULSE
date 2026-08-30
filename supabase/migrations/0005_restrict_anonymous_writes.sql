-- Supabase's own dashboard warns, on enabling anonymous sign-ins, that anonymous sessions
-- authenticate as the "authenticated" Postgres role — the same role every real signed-up
-- user has — and therefore inherit every RLS policy written for "authenticated" already.
-- That's exactly what makes anonymous browsing work at all against this app's existing
-- public-read policies (venues/hours/reports/etc. are all `using (true)` anyway). But it
-- also means every *self-write* policy below — written back when "authenticated" could
-- only ever mean a real registered user — would let a freshly-minted, zero-friction
-- anonymous session write directly via Supabase's REST API (public anon key + its own
-- session JWT), completely bypassing this app's ANONYMOUS_SESSION check (see
-- lib/auth/index.ts) — that check only runs inside this app's own Next.js routes, which
-- write through supabaseAdmin() (the service role, which bypasses RLS) and never touch
-- these policies either way. Since anonymous sessions cost nothing to mint, that's a real
-- spam/abuse surface (fake reports, fake friend requests, fake presence) opened up
-- specifically by turning anonymous sign-ins on — not a theoretical one. This migration
-- closes it at the database layer to match what the app already enforces in code.
create or replace function is_anonymous_session() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles for insert
  with check (auth_user_id = auth.uid() and role = 'USER' and not is_anonymous_session());

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and role = (select role from profiles p where p.auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists venue_reports_self_insert on venue_reports;
create policy venue_reports_self_insert on venue_reports for insert
  with check (
    user_id in (select id from profiles where auth_user_id = auth.uid())
    and is_verified_nearby = false
    and trust_weight_at_submission = 0.5
    and report_source = 'APP'
    and not is_anonymous_session()
  );

drop policy if exists report_flags_self_insert on report_flags;
create policy report_flags_self_insert on report_flags for insert
  with check (
    flagged_by in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists friendships_requester_insert on friendships;
create policy friendships_requester_insert on friendships for insert
  with check (
    requester_id in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists friendships_participant_update on friendships;
create policy friendships_participant_update on friendships for update
  using (
    requester_id in (select id from profiles where auth_user_id = auth.uid())
    or addressee_id in (select id from profiles where auth_user_id = auth.uid())
  )
  with check (
    not is_anonymous_session()
    and (status <> 'ACCEPTED' or addressee_id in (select id from profiles where auth_user_id = auth.uid()))
  );

drop policy if exists close_friends_owner_all on close_friends;
create policy close_friends_owner_all on close_friends for all
  using (
    owner_id in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists presence_preferences_owner_all on presence_preferences;
create policy presence_preferences_owner_all on presence_preferences for all
  using (
    user_id in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

-- presence_events_friend_read (a separate, viewer-side policy) needs no change: an
-- anonymous viewer can never hold an ACCEPTED friendship in the first place once
-- friendships_requester_insert blocks them from creating one.
drop policy if exists presence_events_owner_all on presence_events;
create policy presence_events_owner_all on presence_events for all
  using (
    user_id in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists saved_venues_owner_all on saved_venues;
create policy saved_venues_owner_all on saved_venues for all
  using (
    user_id in (select id from profiles where auth_user_id = auth.uid())
    and not is_anonymous_session()
  );

drop policy if exists venue_owners_self_insert on venue_owners;
create policy venue_owners_self_insert on venue_owners for insert
  with check (
    profile_id in (select id from profiles where auth_user_id = auth.uid())
    and status = 'PENDING'
    and not is_anonymous_session()
  );
