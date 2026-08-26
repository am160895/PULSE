import type { Profile, VenueOwner, VenueOwnerStatus } from "@/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrap, SupabaseQueryError } from "@/lib/supabase/unwrap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToVenueOwner(row: Row): VenueOwner {
  return {
    id: row.id,
    venueId: row.venue_id,
    profileId: row.profile_id,
    status: row.status,
    requestedAt: row.requested_at,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** venue_id set this profile is a VERIFIED owner of — PENDING/REJECTED/REVOKED never
 * grant access. This is the set every /api/owner/** route checks a requested venue id
 * against before touching any data. */
export async function listVerifiedOwnedVenueIds(profileId: string): Promise<Set<string>> {
  const rows: Row[] = unwrap(
    await supabaseAdmin().from("venue_owners").select("venue_id").eq("profile_id", profileId).eq("status", "VERIFIED")
  );
  return new Set(rows.map((r) => r.venue_id));
}

/** Any existing row (of any status) for this (venue, profile) pair — used to decide
 * whether a claim request is brand new or reviving/duplicating a prior one. */
export async function getOwnershipRequest(venueId: string, profileId: string): Promise<VenueOwner | undefined> {
  const row = unwrap(
    await supabaseAdmin().from("venue_owners").select().eq("venue_id", venueId).eq("profile_id", profileId).maybeSingle()
  );
  return row ? rowToVenueOwner(row) : undefined;
}

/**
 * Creates a claim request — always lands as PENDING, never anything else (the RLS policy
 * backs this up at the DB layer too). Returns null if this exact (venue, profile) pair
 * already has a row (any status) — re-claiming isn't a new request, see the route for
 * how a REJECTED/REVOKED row gets explicitly revived instead of silently duplicated.
 */
export async function createOwnershipRequest(venueId: string, profileId: string): Promise<VenueOwner | null> {
  const { data, error } = await supabaseAdmin()
    .from("venue_owners")
    .insert({ venue_id: venueId, profile_id: profileId, status: "PENDING" })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new SupabaseQueryError(error);
  }
  return rowToVenueOwner(data);
}

/** Revives an existing REJECTED/REVOKED row back to PENDING — the unique(venue_id,
 * profile_id) constraint means a second claim attempt must update the existing row, not
 * insert a new one. Never called for a row that's already PENDING/VERIFIED. */
export async function reviveOwnershipRequest(id: string): Promise<VenueOwner> {
  const row = unwrap(
    await supabaseAdmin()
      .from("venue_owners")
      .update({ status: "PENDING", verified_at: null, verified_by: null })
      .eq("id", id)
      .select()
      .single()
  );
  return rowToVenueOwner(row);
}

export interface AdminOwnershipRequestView {
  request: VenueOwner;
  venueName: string;
  requester: Pick<Profile, "id" | "displayName" | "username">;
}

/** Every claim request, newest first — the admin review queue. */
export async function listOwnershipRequestsForAdmin(): Promise<AdminOwnershipRequestView[]> {
  // venue_owners has two FKs into profiles (profile_id, verified_by) — PostgREST can't
  // pick one without a hint, hence `profiles!profile_id(...)` rather than plain `profiles(...)`.
  const rows: Row[] = unwrap(
    await supabaseAdmin()
      .from("venue_owners")
      .select("*, venues(name), profiles!profile_id(id, display_name, username)")
      .order("requested_at", { ascending: false })
  );
  return rows.map((row) => ({
    request: rowToVenueOwner(row),
    venueName: row.venues?.name ?? "(unknown venue)",
    requester: { id: row.profiles?.id, displayName: row.profiles?.display_name, username: row.profiles?.username },
  }));
}

/** Callers (API routes) are responsible for the admin-role check — this enforces
 * nothing on its own, same convention as every other repository function in this app. */
export async function setOwnershipRequestStatus(
  id: string,
  status: Extract<VenueOwnerStatus, "VERIFIED" | "REJECTED" | "REVOKED">,
  adminProfileId: string
): Promise<VenueOwner | null> {
  const columns: Row = { status };
  if (status === "VERIFIED") {
    columns.verified_at = new Date().toISOString();
    columns.verified_by = adminProfileId;
  } else {
    columns.verified_at = null;
    columns.verified_by = null;
  }
  const row = unwrap(await supabaseAdmin().from("venue_owners").update(columns).eq("id", id).select().maybeSingle());
  if (!row) return null;
  const updated = rowToVenueOwner(row);
  await recomputeVenueClaimStatus(updated.venueId);
  return updated;
}

/** venues.claim_status is a derived, denormalized display flag, never hand-tracked —
 * recomputed fresh after any status change, matching this app's existing philosophy of
 * deriving state (openState, coverageState) rather than mutating an independent flag. */
export async function recomputeVenueClaimStatus(venueId: string): Promise<void> {
  const rows: Row[] = unwrap(await supabaseAdmin().from("venue_owners").select("status").eq("venue_id", venueId));
  const statuses = new Set(rows.map((r) => r.status as VenueOwnerStatus));
  const claimStatus = statuses.has("VERIFIED") ? "VERIFIED" : statuses.has("PENDING") ? "PENDING" : "UNCLAIMED";
  unwrap(await supabaseAdmin().from("venues").update({ claim_status: claimStatus }).eq("id", venueId));
}
