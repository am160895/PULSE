import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById } from "@/lib/data/repository";
import {
  createPresenceEvent,
  endPresence,
  getOwnActivePresence,
  getPresencePreferences,
} from "@/lib/data/social";
import { PRESENCE_MAX_TIMEOUT_MINUTES } from "@/config/constants";
import type { PresencePreferences, PresenceStatus } from "@/types";
import { awardXpForPresence } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";

// Settings > Privacy exposes three independent toggles, one per presence status — sharing
// AT_VENUE must not silently permit NEARBY/RECENTLY_HERE (and vice versa) just because one
// switch happens to be on. HEADING_THERE has no dedicated toggle in the UI; it's gated by
// the same switch as AT_VENUE since it's the closest conceptual match (committing to go).
function isStatusAllowed(status: PresenceStatus, preferences: PresencePreferences): boolean {
  switch (status) {
    case "AT_VENUE":
    case "HEADING_THERE":
      return preferences.allowVenuePresence;
    case "NEARBY":
      return preferences.allowNearbyPresence;
    case "RECENTLY_HERE":
      return preferences.allowRecentPresence;
  }
}

const bodySchema = z.object({
  venueId: z.string(),
  status: z.enum(["AT_VENUE", "HEADING_THERE", "NEARBY", "RECENTLY_HERE"]),
  visibility: z.enum(["PRIVATE", "FRIENDS", "CLOSE_FRIENDS"]),
  timeoutMinutes: z.number().min(15).max(PRESENCE_MAX_TIMEOUT_MINUTES).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [active, preferences] = await Promise.all([
    getOwnActivePresence(session.profile.id),
    getPresencePreferences(session.profile.id),
  ]);
  return NextResponse.json({ active: active ?? null, preferences });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const venue = await getVenueById(parsed.data.venueId);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const preferences = await getPresencePreferences(session.profile.id);
  if (!isStatusAllowed(parsed.data.status, preferences)) {
    return NextResponse.json(
      { error: "This kind of presence sharing is off. Turn it on in Settings > Privacy first." },
      { status: 403 }
    );
  }

  const event = await createPresenceEvent({
    userId: session.profile.id,
    venueId: parsed.data.venueId,
    status: parsed.data.status,
    visibility: parsed.data.visibility,
    timeoutMinutes: parsed.data.timeoutMinutes ?? preferences.presenceTimeoutMinutes,
  });

  // Only "I'm actually at this venue" earns XP — HEADING_THERE/NEARBY/RECENTLY_HERE are
  // weaker, unverifiable-by-nature signals the spec doesn't reward.
  if (parsed.data.status !== "AT_VENUE") {
    return NextResponse.json({ ok: true, presence: event, xp: null, badgesUnlocked: [] });
  }

  const now = new Date();
  const xp = await awardXpForPresence(session.profile.id, venue, now);
  const badgesUnlocked = xp.awarded ? await evaluateBadges(session.profile.id, now) : [];

  return NextResponse.json({
    ok: true,
    presence: event,
    xp: { awarded: xp.awarded, xpAmount: xp.xpAmount, totalXp: xp.totalXp, level: xp.level, leveledUp: xp.leveledUp },
    badgesUnlocked,
  });
}

export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await endPresence(session.profile.id);
  return NextResponse.json({ ok: true });
}
