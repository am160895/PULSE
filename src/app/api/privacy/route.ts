import { NextResponse } from "next/server";
import { z } from "zod";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { getPresencePreferences, listBlockedProfiles, updatePresencePreferences } from "@/lib/data/social";
import { PRESENCE_MAX_TIMEOUT_MINUTES } from "@/config/constants";

const patchSchema = z.object({
  defaultVisibility: z.enum(["PRIVATE", "FRIENDS", "CLOSE_FRIENDS"]).optional(),
  allowVenuePresence: z.boolean().optional(),
  allowNearbyPresence: z.boolean().optional(),
  allowRecentPresence: z.boolean().optional(),
  presenceTimeoutMinutes: z.number().min(15).max(PRESENCE_MAX_TIMEOUT_MINUTES).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [preferences, blocked] = await Promise.all([
    getPresencePreferences(session.profile.id),
    listBlockedProfiles(session.profile.id),
  ]);

  return NextResponse.json({ preferences, blocked });
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const preferences = await updatePresencePreferences(session.profile.id, parsed.data);
  return NextResponse.json({ ok: true, preferences });
}
