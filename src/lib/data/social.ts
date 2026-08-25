import type {
  Friendship,
  FriendshipStatus,
  PresenceEvent,
  PresencePreferences,
  Profile,
  PresenceSummary,
  UserTrustScore,
} from "@/types";
import { canViewPresence } from "@/lib/presence/visibility";
import { defaultPresencePreferences } from "@/lib/presence/defaults";
import { TRUST_SCORE_DEFAULT } from "@/config/constants";
import { getVenueById } from "./repository";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrap } from "@/lib/supabase/unwrap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ---------------- row <-> domain mappers ----------------

function rowToProfile(row: Row): Profile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    homeCity: row.home_city,
    interests: row.interests ?? [],
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFriendship(row: Row): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPresencePrefs(row: Row): PresencePreferences {
  return {
    userId: row.user_id,
    defaultVisibility: row.default_visibility,
    allowVenuePresence: row.allow_venue_presence,
    allowNearbyPresence: row.allow_nearby_presence,
    allowRecentPresence: row.allow_recent_presence,
    presenceTimeoutMinutes: row.presence_timeout_minutes,
    updatedAt: row.updated_at,
  };
}

function rowToPresenceEvent(row: Row): PresenceEvent {
  return {
    id: row.id,
    userId: row.user_id,
    venueId: row.venue_id,
    status: row.status,
    visibility: row.visibility,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function rowToTrustScore(row: Row): UserTrustScore {
  return {
    userId: row.user_id,
    trustScore: row.trust_score,
    reportsSubmitted: row.reports_submitted,
    reportsConfirmed: row.reports_confirmed,
    reportsFlagged: row.reports_flagged,
    updatedAt: row.updated_at,
  };
}

// ---------------- profiles ----------------
// Identity/password/email live in Supabase Auth (auth.users), not here — see
// src/lib/auth/index.ts. This file only ever deals with the profiles table onward.

/**
 * Creates the profiles row (+ default trust score and presence preferences) for an
 * already-created Supabase Auth user. Called right after supabaseServer().auth.signUp()
 * succeeds — see lib/auth/index.ts's signup().
 */
export async function createUserWithProfile(fields: {
  authUserId: string;
  email: string;
  username: string;
  displayName: string;
  homeCity: string;
}): Promise<Profile> {
  // Bootstrap problem: the very first admin can't be promoted by an admin panel that
  // doesn't have an admin yet. INITIAL_ADMIN_EMAIL is the standard way out — set it once,
  // sign up with that address, and every account after it goes through the normal
  // "an admin promotes you" path (profiles_self_insert's RLS check pins new rows to USER
  // regardless of what a client sends — this only ever runs server-side with the service
  // role, which bypasses RLS, so the check here is what actually decides the role).
  const normalizedEmail = fields.email.trim().toLowerCase();
  const role = normalizedEmail === process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() ? "ADMIN" : "USER";

  const row = unwrap(
    await supabaseAdmin()
      .from("profiles")
      .insert({
        auth_user_id: fields.authUserId,
        username: fields.username,
        display_name: fields.displayName,
        home_city: fields.homeCity,
        interests: [],
        role,
      })
      .select()
      .single()
  );
  const profile = rowToProfile(row);

  // Reports/presence/trust/saved key off profiles.id throughout (matching the SQL schema) —
  // auth_user_id is only ever used to resolve a session into a profile.
  unwrap(
    await supabaseAdmin()
      .from("user_trust_scores")
      .insert({ user_id: profile.id, trust_score: TRUST_SCORE_DEFAULT })
  );
  const prefs = defaultPresencePreferences(profile.id, profile.createdAt);
  unwrap(
    await supabaseAdmin().from("presence_preferences").insert({
      user_id: prefs.userId,
      default_visibility: prefs.defaultVisibility,
      allow_venue_presence: prefs.allowVenuePresence,
      allow_nearby_presence: prefs.allowNearbyPresence,
      allow_recent_presence: prefs.allowRecentPresence,
      presence_timeout_minutes: prefs.presenceTimeoutMinutes,
    })
  );

  return profile;
}

export async function getProfileByAuthUserId(authUserId: string): Promise<Profile | undefined> {
  const row = unwrap(await supabaseAdmin().from("profiles").select().eq("auth_user_id", authUserId).maybeSingle());
  return row ? rowToProfile(row) : undefined;
}

export async function getProfileById(profileId: string): Promise<Profile | undefined> {
  const row = unwrap(await supabaseAdmin().from("profiles").select().eq("id", profileId).maybeSingle());
  return row ? rowToProfile(row) : undefined;
}

export async function getProfileByUsername(username: string): Promise<Profile | undefined> {
  const row = unwrap(
    await supabaseAdmin().from("profiles").select().ilike("username", username.trim()).maybeSingle()
  );
  return row ? rowToProfile(row) : undefined;
}

export type PublicProfile = Pick<Profile, "id" | "username" | "displayName" | "avatarUrl" | "homeCity">;

/** authUserId is the identifier session cookies resolve through and is deliberately kept
 * server-side everywhere else — never spread a full Profile into an API response. */
export function toPublicProfile(profile: Profile): PublicProfile {
  const { id, username, displayName, avatarUrl, homeCity } = profile;
  return { id, username, displayName, avatarUrl, homeCity };
}

export async function updateProfile(
  profileId: string,
  patch: Partial<Pick<Profile, "displayName" | "avatarUrl" | "homeCity" | "interests">>
): Promise<Profile | undefined> {
  const columns: Row = {};
  if (patch.displayName !== undefined) columns.display_name = patch.displayName;
  if (patch.avatarUrl !== undefined) columns.avatar_url = patch.avatarUrl;
  if (patch.homeCity !== undefined) columns.home_city = patch.homeCity;
  if (patch.interests !== undefined) columns.interests = patch.interests;

  const row = unwrap(await supabaseAdmin().from("profiles").update(columns).eq("id", profileId).select().maybeSingle());
  return row ? rowToProfile(row) : undefined;
}

/** Used only by the dev-only /api/dev/simulate route to pick simulated reporters. */
export async function listOtherProfileIds(excludeProfileId: string): Promise<string[]> {
  const rows: Row[] = unwrap(await supabaseAdmin().from("profiles").select("id").neq("id", excludeProfileId));
  return rows.map((r) => r.id);
}

// ---------------- admin ----------------

export async function isAdminProfile(profileId: string): Promise<boolean> {
  const profile = await getProfileById(profileId);
  return profile?.role === "ADMIN";
}

export interface AdminProfileView {
  profile: Profile;
  email: string;
  reportsSubmitted: number;
  trustScore: number;
}

/** Every user, with the fields an admin needs and nothing more sensitive (no password —
 * that lives entirely in Supabase Auth and is never readable here anyway). */
export async function listAllProfilesForAdmin(): Promise<AdminProfileView[]> {
  const profileRows: Row[] = unwrap(await supabaseAdmin().from("profiles").select());
  const trustRows: Row[] = unwrap(await supabaseAdmin().from("user_trust_scores").select());
  const trustByUserId = new Map(trustRows.map((t) => [t.user_id, rowToTrustScore(t)]));

  // Email lives in Supabase Auth, not profiles — one admin API call covers every user at
  // this app's current demo scale; a real user base would need paginated listUsers() calls.
  const { data: authList, error } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Supabase error: ${error.message}`);
  const emailByAuthUserId = new Map(authList.users.map((u) => [u.id, u.email ?? "(unknown)"]));

  return profileRows.map((row) => {
    const profile = rowToProfile(row);
    const trust = trustByUserId.get(profile.id);
    return {
      profile,
      email: emailByAuthUserId.get(profile.authUserId) ?? "(unknown)",
      reportsSubmitted: trust?.reportsSubmitted ?? 0,
      trustScore: trust?.trustScore ?? TRUST_SCORE_DEFAULT,
    };
  });
}

/** Returns null if profileId doesn't exist, otherwise the updated profile. Callers must
 * check the acting session is itself an admin before calling this — this function
 * enforces nothing on its own, matching every other repository function in this file. */
export async function setProfileRole(profileId: string, role: Profile["role"]): Promise<Profile | null> {
  const row = unwrap(await supabaseAdmin().from("profiles").update({ role }).eq("id", profileId).select().maybeSingle());
  return row ? rowToProfile(row) : null;
}

// ---------------- trust ----------------

export async function getTrustScore(userId: string): Promise<UserTrustScore> {
  const existing = unwrap(await supabaseAdmin().from("user_trust_scores").select().eq("user_id", userId).maybeSingle());
  if (existing) return rowToTrustScore(existing);
  const created = unwrap(
    await supabaseAdmin()
      .from("user_trust_scores")
      .insert({ user_id: userId, trust_score: TRUST_SCORE_DEFAULT })
      .select()
      .single()
  );
  return rowToTrustScore(created);
}

export async function saveTrustScore(score: UserTrustScore): Promise<void> {
  unwrap(
    await supabaseAdmin()
      .from("user_trust_scores")
      .upsert({
        user_id: score.userId,
        trust_score: score.trustScore,
        reports_submitted: score.reportsSubmitted,
        reports_confirmed: score.reportsConfirmed,
        reports_flagged: score.reportsFlagged,
        updated_at: score.updatedAt,
      })
  );
}

export async function allTrustScoresMap(): Promise<Map<string, number>> {
  const rows: Row[] = unwrap(await supabaseAdmin().from("user_trust_scores").select("user_id, trust_score"));
  return new Map(rows.map((t) => [t.user_id, t.trust_score]));
}

// ---------------- friendships ----------------
// Joins to `profiles` are done as a second query rather than a PostgREST embed — friendships
// has two FKs to profiles (requester_id, addressee_id), and embedding through an ambiguous
// relationship needs the exact auto-generated constraint name, which isn't worth depending on.

async function profilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const rows: Row[] = unwrap(await supabaseAdmin().from("profiles").select().in("id", [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, rowToProfile(r)]));
}

export async function getFriendshipBetween(profileA: string, profileB: string): Promise<Friendship | undefined> {
  const row = unwrap(
    await supabaseAdmin()
      .from("friendships")
      .select()
      .or(
        `and(requester_id.eq.${profileA},addressee_id.eq.${profileB}),and(requester_id.eq.${profileB},addressee_id.eq.${profileA})`
      )
      .maybeSingle()
  );
  return row ? rowToFriendship(row) : undefined;
}

export async function getFriendshipStatus(viewerId: string, ownerId: string): Promise<FriendshipStatus | null> {
  const f = await getFriendshipBetween(viewerId, ownerId);
  return f?.status ?? null;
}

export async function listFriendshipsForProfile(profileId: string): Promise<Friendship[]> {
  const rows = unwrap(
    await supabaseAdmin().from("friendships").select().or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
  );
  return rows.map(rowToFriendship);
}

export interface PendingRequest {
  friendshipId: string;
  profile: Profile;
  createdAt: string;
}

export async function listPendingIncoming(profileId: string): Promise<PendingRequest[]> {
  const rows: Row[] = unwrap(
    await supabaseAdmin().from("friendships").select().eq("addressee_id", profileId).eq("status", "PENDING")
  );
  const profiles = await profilesByIds(rows.map((r) => r.requester_id));
  return rows
    .map((r) => ({ friendshipId: r.id, profile: profiles.get(r.requester_id)!, createdAt: r.created_at }))
    .filter((r) => !!r.profile);
}

export async function listPendingOutgoing(profileId: string): Promise<PendingRequest[]> {
  const rows: Row[] = unwrap(
    await supabaseAdmin().from("friendships").select().eq("requester_id", profileId).eq("status", "PENDING")
  );
  const profiles = await profilesByIds(rows.map((r) => r.addressee_id));
  return rows
    .map((r) => ({ friendshipId: r.id, profile: profiles.get(r.addressee_id)!, createdAt: r.created_at }))
    .filter((r) => !!r.profile);
}

export async function listAcceptedFriendProfiles(profileId: string): Promise<Profile[]> {
  const friendships = (await listFriendshipsForProfile(profileId)).filter((f) => f.status === "ACCEPTED");
  const friendIds = friendships.map((f) => (f.requesterId === profileId ? f.addresseeId : f.requesterId));
  const profiles = await profilesByIds(friendIds);
  return friendIds.map((id) => profiles.get(id)).filter((p): p is Profile => !!p);
}

export async function createFriendRequest(
  requesterId: string,
  addresseeId: string
): Promise<Friendship | { error: string }> {
  if (requesterId === addresseeId) return { error: "Cannot friend yourself" };
  const existing = await getFriendshipBetween(requesterId, addresseeId);
  if (existing) return { error: "A friendship or request already exists" };

  const { data, error } = await supabaseAdmin()
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "PENDING" })
    .select()
    .single();
  // 23505 = unique_violation — the unordered-pair index catching a race with a concurrent
  // request, since the pre-check above isn't atomic with the insert.
  if (error) {
    if (error.code === "23505") return { error: "A friendship or request already exists" };
    throw new Error(`Supabase error: ${error.message}`);
  }
  return rowToFriendship(data);
}

export async function respondToFriendRequest(
  friendshipId: string,
  addresseeId: string,
  accept: boolean
): Promise<Friendship | { error: string }> {
  const row = unwrap(await supabaseAdmin().from("friendships").select().eq("id", friendshipId).maybeSingle());
  if (!row) return { error: "Request not found" };
  const friendship = rowToFriendship(row);
  if (friendship.addresseeId !== addresseeId) return { error: "Not authorized to respond to this request" };
  if (friendship.status !== "PENDING") return { error: "Request already resolved" };

  if (!accept) {
    unwrap(await supabaseAdmin().from("friendships").delete().eq("id", friendshipId));
    return friendship;
  }

  const updated = unwrap(
    await supabaseAdmin().from("friendships").update({ status: "ACCEPTED" }).eq("id", friendshipId).select().single()
  );
  return rowToFriendship(updated);
}

export async function blockProfile(blockerId: string, blockedId: string): Promise<Friendship> {
  const existing = await getFriendshipBetween(blockerId, blockedId);
  if (existing) {
    // The existing row's (requester_id, addressee_id) reflects who originally sent the
    // friend request, which is irrelevant once one side blocks the other — reassign both
    // to (blocker, blocked) rather than only flipping status. Otherwise, if the row
    // happened to be stored in the opposite direction (the blocker was the addressee of
    // the original request), listBlockedProfiles/unblockProfile — which both filter on
    // requester_id === the calling profile — would look up the wrong person's blocked
    // list entirely, and worse: the person who got blocked could still successfully call
    // unblockProfile(themselves, blocker) and silently erase a block placed against them.
    const updated = unwrap(
      await supabaseAdmin()
        .from("friendships")
        .update({ requester_id: blockerId, addressee_id: blockedId, status: "BLOCKED" })
        .eq("id", existing.id)
        .select()
        .single()
    );
    return rowToFriendship(updated);
  }
  const created = unwrap(
    await supabaseAdmin()
      .from("friendships")
      .insert({ requester_id: blockerId, addressee_id: blockedId, status: "BLOCKED" })
      .select()
      .single()
  );
  return rowToFriendship(created);
}

export async function listBlockedProfiles(profileId: string): Promise<Profile[]> {
  const rows: Row[] = unwrap(
    await supabaseAdmin().from("friendships").select().eq("requester_id", profileId).eq("status", "BLOCKED")
  );
  const profiles = await profilesByIds(rows.map((r) => r.addressee_id));
  return rows.map((r) => profiles.get(r.addressee_id)).filter((p): p is Profile => !!p);
}

export async function unblockProfile(blockerId: string, blockedId: string): Promise<void> {
  unwrap(
    await supabaseAdmin()
      .from("friendships")
      .delete()
      .eq("requester_id", blockerId)
      .eq("addressee_id", blockedId)
      .eq("status", "BLOCKED")
  );
}

export async function isCloseFriend(ownerId: string, friendProfileId: string): Promise<boolean> {
  const row = unwrap(
    await supabaseAdmin()
      .from("close_friends")
      .select()
      .eq("owner_id", ownerId)
      .eq("friend_profile_id", friendProfileId)
      .maybeSingle()
  );
  return !!row;
}

export async function setCloseFriend(ownerId: string, friendProfileId: string, isClose: boolean): Promise<void> {
  unwrap(
    await supabaseAdmin().from("close_friends").delete().eq("owner_id", ownerId).eq("friend_profile_id", friendProfileId)
  );
  if (isClose) {
    unwrap(await supabaseAdmin().from("close_friends").insert({ owner_id: ownerId, friend_profile_id: friendProfileId }));
  }
}

// ---------------- presence ----------------

export async function getPresencePreferences(userId: string): Promise<PresencePreferences> {
  const existing = unwrap(
    await supabaseAdmin().from("presence_preferences").select().eq("user_id", userId).maybeSingle()
  );
  if (existing) return rowToPresencePrefs(existing);
  const created = defaultPresencePreferences(userId, new Date().toISOString());
  const row = unwrap(
    await supabaseAdmin()
      .from("presence_preferences")
      .insert({
        user_id: created.userId,
        default_visibility: created.defaultVisibility,
        allow_venue_presence: created.allowVenuePresence,
        allow_nearby_presence: created.allowNearbyPresence,
        allow_recent_presence: created.allowRecentPresence,
        presence_timeout_minutes: created.presenceTimeoutMinutes,
      })
      .select()
      .single()
  );
  return rowToPresencePrefs(row);
}

export async function updatePresencePreferences(
  userId: string,
  patch: Partial<Omit<PresencePreferences, "userId">>
): Promise<PresencePreferences> {
  await getPresencePreferences(userId); // ensures a row exists to update
  const columns: Row = {};
  if (patch.defaultVisibility !== undefined) columns.default_visibility = patch.defaultVisibility;
  if (patch.allowVenuePresence !== undefined) columns.allow_venue_presence = patch.allowVenuePresence;
  if (patch.allowNearbyPresence !== undefined) columns.allow_nearby_presence = patch.allowNearbyPresence;
  if (patch.allowRecentPresence !== undefined) columns.allow_recent_presence = patch.allowRecentPresence;
  if (patch.presenceTimeoutMinutes !== undefined) columns.presence_timeout_minutes = patch.presenceTimeoutMinutes;

  const row = unwrap(
    await supabaseAdmin().from("presence_preferences").update(columns).eq("user_id", userId).select().single()
  );
  return rowToPresencePrefs(row);
}

export async function createPresenceEvent(fields: {
  userId: string;
  venueId: string;
  status: PresenceEvent["status"];
  visibility: PresenceEvent["visibility"];
  timeoutMinutes: number;
}): Promise<PresenceEvent> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + fields.timeoutMinutes * 60_000).toISOString();

  // Only one active presence per user at a time — starting a new one supersedes the last.
  unwrap(await supabaseAdmin().from("presence_events").delete().eq("user_id", fields.userId));
  const row = unwrap(
    await supabaseAdmin()
      .from("presence_events")
      .insert({
        user_id: fields.userId,
        venue_id: fields.venueId,
        status: fields.status,
        visibility: fields.visibility,
        started_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .select()
      .single()
  );
  return rowToPresenceEvent(row);
}

export async function endPresence(userId: string): Promise<void> {
  unwrap(await supabaseAdmin().from("presence_events").delete().eq("user_id", userId));
}

export async function getOwnActivePresence(userId: string, now = new Date()): Promise<PresenceEvent | undefined> {
  const row = unwrap(
    await supabaseAdmin()
      .from("presence_events")
      .select()
      .eq("user_id", userId)
      .gt("expires_at", now.toISOString())
      .maybeSingle()
  );
  return row ? rowToPresenceEvent(row) : undefined;
}

export async function listActivePresenceForVenue(venueId: string, now = new Date()): Promise<PresenceEvent[]> {
  const rows = unwrap(
    await supabaseAdmin().from("presence_events").select().eq("venue_id", venueId).gt("expires_at", now.toISOString())
  );
  return rows.map(rowToPresenceEvent);
}

/** All currently-visible-to-viewer presence, across every venue — used for the Friends tab and map "friends nearby". */
export async function listVisiblePresenceForViewer(viewerProfileId: string, now = new Date()): Promise<PresenceSummary[]> {
  const rows = unwrap(await supabaseAdmin().from("presence_events").select().gt("expires_at", now.toISOString()));
  const presences = rows.map(rowToPresenceEvent);
  const summaries: PresenceSummary[] = [];

  for (const presence of presences) {
    const ownerProfile = await getProfileById(presence.userId);
    if (!ownerProfile) continue;

    const friendshipStatus = await getFriendshipStatus(viewerProfileId, ownerProfile.id);
    const visible = canViewPresence({
      viewerId: viewerProfileId,
      ownerId: ownerProfile.id,
      visibility: presence.visibility,
      expiresAt: new Date(presence.expiresAt),
      now,
      friendshipStatus,
      viewerIsCloseFriendOfOwner: await isCloseFriend(ownerProfile.id, viewerProfileId),
    });
    if (!visible) continue;

    const venue = await getVenueById(presence.venueId);
    summaries.push({
      profileId: ownerProfile.id,
      displayName: ownerProfile.displayName,
      avatarUrl: ownerProfile.avatarUrl,
      status: presence.status,
      venueId: presence.venueId,
      venueName: venue?.name ?? null,
      startedAt: presence.startedAt,
    });
  }

  return summaries;
}

/** Privacy-safe aggregate used by the score engine: anyone opted into AT_VENUE presence, not filtered by relationship. */
export async function countAnyPresentAtVenue(venueId: string, now = new Date()): Promise<number> {
  const active = await listActivePresenceForVenue(venueId, now);
  return active.filter((p) => p.status === "AT_VENUE").length;
}

/** Batched sibling of countAnyPresentAtVenue — one round-trip for N venues instead of N.
 * Used by computeVenueStatesBatch (composeVenue.ts) for map/list views. */
export async function countPresentAtVenues(venueIds: string[], now = new Date()): Promise<Map<string, number>> {
  if (venueIds.length === 0) return new Map();
  const rows: Row[] = unwrap(
    await supabaseAdmin()
      .from("presence_events")
      .select("venue_id")
      .in("venue_id", venueIds)
      .eq("status", "AT_VENUE")
      .gt("expires_at", now.toISOString())
  );
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.venue_id, (counts.get(row.venue_id) ?? 0) + 1);
  return counts;
}
