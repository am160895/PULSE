import type { Perk, PerkRedemption } from "@/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrap, SupabaseQueryError } from "@/lib/supabase/unwrap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToPerk(row: Row): Perk {
  return {
    id: row.id,
    venueId: row.venue_id,
    title: row.title,
    description: row.description,
    requiredMinXp: row.required_min_xp,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function rowToRedemption(row: Row): PerkRedemption {
  return { id: row.id, perkId: row.perk_id, userId: row.user_id, redeemedAt: row.redeemed_at };
}

export async function listActivePerks(): Promise<Perk[]> {
  const rows = unwrap(await supabaseAdmin().from("perks").select().eq("is_active", true).order("required_min_xp"));
  return rows.map(rowToPerk);
}

/** Unlike listActivePerks(), includes inactive perks — an admin needs to see what they've turned off. */
export async function listAllPerksAdmin(): Promise<Perk[]> {
  const rows = unwrap(await supabaseAdmin().from("perks").select().order("created_at", { ascending: false }));
  return rows.map(rowToPerk);
}

export interface NewPerkInput {
  venueId?: string | null;
  title: string;
  description: string;
  requiredMinXp: number;
  isActive: boolean;
}

export async function createPerkAdmin(input: NewPerkInput, createdBy: string): Promise<Perk> {
  const row = unwrap(
    await supabaseAdmin()
      .from("perks")
      .insert({
        venue_id: input.venueId ?? null,
        title: input.title,
        description: input.description,
        required_min_xp: input.requiredMinXp,
        is_active: input.isActive,
        created_by: createdBy,
      })
      .select()
      .single()
  );
  return rowToPerk(row);
}

export async function updatePerkAdmin(id: string, patch: Partial<NewPerkInput>): Promise<Perk | null> {
  const columns: Row = {};
  if (patch.venueId !== undefined) columns.venue_id = patch.venueId;
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.description !== undefined) columns.description = patch.description;
  if (patch.requiredMinXp !== undefined) columns.required_min_xp = patch.requiredMinXp;
  if (patch.isActive !== undefined) columns.is_active = patch.isActive;

  if (Object.keys(columns).length === 0) {
    const existing = unwrap(await supabaseAdmin().from("perks").select().eq("id", id).maybeSingle());
    return existing ? rowToPerk(existing) : null;
  }
  const row = unwrap(await supabaseAdmin().from("perks").update(columns).eq("id", id).select().maybeSingle());
  return row ? rowToPerk(row) : null;
}

export async function deletePerkAdmin(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("perks").delete({ count: "exact" }).eq("id", id);
  if (error) throw new SupabaseQueryError(error);
  return (count ?? 0) > 0;
}

export async function listRedemptionsForUser(userId: string): Promise<PerkRedemption[]> {
  const rows = unwrap(await supabaseAdmin().from("perk_redemptions").select().eq("user_id", userId));
  return rows.map(rowToRedemption);
}

/** Returns null if this exact (perkId, userId) was already redeemed — the unique
 * constraint on perk_redemptions is the idempotency check, not a pre-read (same
 * insert-and-catch-23505 precedent as insertXpEvent/awardBadge). */
export async function insertRedemption(perkId: string, userId: string): Promise<PerkRedemption | null> {
  const { data, error } = await supabaseAdmin()
    .from("perk_redemptions")
    .insert({ perk_id: perkId, user_id: userId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new SupabaseQueryError(error);
  }
  return rowToRedemption(data);
}
