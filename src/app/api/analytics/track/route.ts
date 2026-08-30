import { NextResponse } from "next/server";
import { z } from "zod";
import { ANALYTICS_EVENT_NAMES } from "@/config/constants";
import { getCurrentSession } from "@/lib/auth";
import { recordAnalyticsEvent } from "@/lib/data/analytics";

// Deliberately open to guests (no ANONYMOUS_SESSION gate) — funnel events are the whole
// point of tracking pre-auth browsing (MAP_VIEW, VENUE_VIEW, SHARED_LINK_OPENED). This is
// the one write route in the app that anonymous sessions are meant to reach.
const schema = z.object({
  event: z.enum(ANALYTICS_EVENT_NAMES),
  venueId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const session = await getCurrentSession();
  await recordAnalyticsEvent({
    event: parsed.data.event,
    profileId: session?.profile.id ?? null,
    venueId: parsed.data.venueId ?? null,
  });

  return NextResponse.json({ ok: true });
}
