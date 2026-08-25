import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { listSavedVenueIds, listVenues } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";
import { buildExploreSections } from "@/lib/pulse/explore";
import { haversineDistanceMeters } from "@/lib/geo";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const userLocation = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

  const now = new Date();
  const [allVenues, savedIds, visiblePresence] = await Promise.all([
    listVenues(),
    listSavedVenueIds(session.profile.id),
    listVisiblePresenceForViewer(session.profile.id, now),
  ]);
  const states = await computeVenueStatesBatch(allVenues, now);

  const venues: VenueWithPulse[] = allVenues.map((venue) => ({
    ...venue,
    ...states.get(venue.id)!,
    isSaved: savedIds.has(venue.id),
    friendsPresent: visiblePresence.filter((p) => p.venueId === venue.id),
    distanceMeters: userLocation ? haversineDistanceMeters(userLocation, { lat: venue.latitude, lng: venue.longitude }) : undefined,
  }));

  return NextResponse.json({ sections: buildExploreSections(venues) });
}
