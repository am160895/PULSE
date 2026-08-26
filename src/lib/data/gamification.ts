import type { BadgeCode, BadgeDefinition, UserBadge, UserNeighborhoodProgress, UserProgress, XpEvent, XpRewardType } from "@/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrap, SupabaseQueryError } from "@/lib/supabase/unwrap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToXpEvent(row: Row): XpEvent {
  return {
    id: row.id,
    userId: row.user_id,
    rewardType: row.reward_type,
    xpAmount: row.xp_amount,
    sourceId: row.source_id,
    venueId: row.venue_id,
    neighborhood: row.neighborhood,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function rowToUserProgress(row: Row): UserProgress {
  return { userId: row.user_id, totalXp: row.total_xp, updatedAt: row.updated_at };
}

function rowToNeighborhoodProgress(row: Row): UserNeighborhoodProgress {
  return { userId: row.user_id, neighborhood: row.neighborhood, xp: row.xp, updatedAt: row.updated_at };
}

function rowToBadgeDefinition(row: Row): BadgeDefinition {
  return { code: row.code, name: row.name, description: row.description, motif: row.motif, sortOrder: row.sort_order };
}

function rowToUserBadge(row: Row): UserBadge {
  return { userId: row.user_id, badgeCode: row.badge_code, neighborhood: row.neighborhood, awardedAt: row.awarded_at, xpEventId: row.xp_event_id };
}

export interface InsertXpEventInput {
  userId: string;
  rewardType: XpRewardType;
  xpAmount: number;
  sourceId: string;
  venueId: string | null;
  neighborhood: string | null;
  metadata?: Record<string, unknown>;
}

/** Returns null if this exact (user, sourceId, rewardType) was already awarded — the
 * unique index on xp_events is the idempotency check, not a pre-read (a pre-read-then-
 * insert would race under concurrent retries the same way the friendship pre-check does;
 * this follows createFriendRequest's existing insert-and-catch-23505 precedent instead). */
export async function insertXpEvent(input: InsertXpEventInput): Promise<XpEvent | null> {
  const { data, error } = await supabaseAdmin()
    .from("xp_events")
    .insert({
      user_id: input.userId,
      reward_type: input.rewardType,
      xp_amount: input.xpAmount,
      source_id: input.sourceId,
      venue_id: input.venueId,
      neighborhood: input.neighborhood,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new SupabaseQueryError(error);
  }
  return rowToXpEvent(data);
}

export async function getUserProgress(userId: string): Promise<UserProgress> {
  const row = unwrap(await supabaseAdmin().from("user_progress").select().eq("user_id", userId).maybeSingle());
  return row ? rowToUserProgress(row) : { userId, totalXp: 0, updatedAt: new Date().toISOString() };
}

export async function listUserNeighborhoodProgress(userId: string): Promise<UserNeighborhoodProgress[]> {
  const rows = unwrap(
    await supabaseAdmin().from("user_neighborhood_progress").select().eq("user_id", userId).order("xp", { ascending: false })
  );
  return rows.map(rowToNeighborhoodProgress);
}

export async function listBadgeDefinitions(): Promise<BadgeDefinition[]> {
  const rows = unwrap(await supabaseAdmin().from("badges").select().order("sort_order"));
  return rows.map(rowToBadgeDefinition);
}

export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  const rows = unwrap(await supabaseAdmin().from("user_badges").select().eq("user_id", userId));
  return rows.map(rowToUserBadge);
}

/** Returns null if this exact (user, badgeCode, neighborhood) was already awarded. */
export async function awardBadge(
  userId: string,
  badgeCode: BadgeCode,
  neighborhood: string,
  xpEventId: string | null
): Promise<UserBadge | null> {
  const { data, error } = await supabaseAdmin()
    .from("user_badges")
    .insert({ user_id: userId, badge_code: badgeCode, neighborhood, xp_event_id: xpEventId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new SupabaseQueryError(error);
  }
  return rowToUserBadge(data);
}

/** Bounded to a generous recency window rather than a full unbounded history — at this
 * app's demo scale this never approaches PostgREST's row cap, but bounding it keeps that
 * true as usage grows instead of silently degrading the way un-paginated queries did
 * elsewhere in this app (see repository.ts's fetchAllRows history). */
const XP_HISTORY_LOOKBACK_DAYS = 120;

/**
 * A defensible, honestly-computable stand-in for "people saw updated PULSE data after
 * your contribution" (spec §10) — this app has no pageview/impression tracking at all, so
 * a literal view-count would be fabricated. Counting OTHER contributors who were active
 * (any XP-earning action) at the same venues is real data: every one of those actions
 * necessarily involved loading that venue's current signal, which included this user's
 * contribution. Framed on the profile page as "other contributors," not "people who saw
 * your data," to stay honest about what's actually being counted.
 */
export async function countDistinctOtherContributorsAtVenues(venueIds: string[], excludeUserId: string, sinceIso: string): Promise<number> {
  if (venueIds.length === 0) return 0;
  const rows: Row[] = unwrap(
    await supabaseAdmin()
      .from("xp_events")
      .select("user_id")
      .in("venue_id", venueIds)
      .neq("user_id", excludeUserId)
      .gte("created_at", sinceIso)
  );
  return new Set(rows.map((r) => r.user_id)).size;
}

export async function listRecentXpEventsForUser(userId: string, now: Date = new Date()): Promise<XpEvent[]> {
  const cutoff = new Date(now.getTime() - XP_HISTORY_LOOKBACK_DAYS * 24 * 3_600_000).toISOString();
  const rows = unwrap(
    await supabaseAdmin()
      .from("xp_events")
      .select()
      .eq("user_id", userId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
  );
  return rows.map(rowToXpEvent);
}
