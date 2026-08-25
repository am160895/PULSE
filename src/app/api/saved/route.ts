import { NextResponse } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { getVenuesByIds, listSavedVenueIds } from "@/lib/data/repository";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const savedIds = await listSavedVenueIds(session.profile.id);
  const savedVenues = await getVenuesByIds([...savedIds]);
  const states = await computeVenueStatesBatch(savedVenues, now);
  const venues: VenueWithPulse[] = savedVenues.map((venue) => ({ ...venue, ...states.get(venue.id)!, isSaved: true }));

  return NextResponse.json({ venues });
}
