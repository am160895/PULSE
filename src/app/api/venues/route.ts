import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { listSavedVenueIds, listVenues, listVenuesInBounds, searchVenues } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";
import { haversineDistanceMeters } from "@/lib/geo";
import { searchExternalDirectoryVenues } from "@/lib/venues/searchExternal";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const north = searchParams.get("north");
  const south = searchParams.get("south");
  const east = searchParams.get("east");
  const west = searchParams.get("west");
  const userLat = searchParams.get("lat");
  const userLng = searchParams.get("lng");
  // NOW (default) hides pure directory listings with zero PULSE data; ALL shows every known
  // venue. Search always searches everything regardless of this toggle (set below).
  const coverageMode = searchParams.get("coverage") === "ALL" ? "ALL" : "NOW";

  const venues = q
    ? [...(await searchVenues(q)), ...(await searchExternalDirectoryVenues(q))]
    : north && south && east && west
      ? await listVenuesInBounds({ north: Number(north), south: Number(south), east: Number(east), west: Number(west) })
      : await listVenues();

  const now = new Date();
  const [states, savedIds, visiblePresence] = await Promise.all([
    computeVenueStatesBatch(venues, now, session.profile.id),
    listSavedVenueIds(session.profile.id),
    listVisiblePresenceForViewer(session.profile.id, now),
  ]);
  const userLocation = userLat && userLng ? { lat: Number(userLat), lng: Number(userLng) } : null;

  const newlyConfirmedSignals = [...states.values()].flatMap((s) => s.newlyConfirmedSignals);
  const newlyUnlockedBadges = [...states.values()].flatMap((s) => s.newlyUnlockedBadges);

  let results: VenueWithPulse[] = venues.map((venue) => {
    const { pulse, openState, coverageState, openStatus, currentPulseStatus, hoursDiscrepancy } = states.get(venue.id)!;
    const friendsPresent = visiblePresence.filter((p) => p.venueId === venue.id);
    return {
      ...venue,
      pulse,
      openState,
      coverageState,
      openStatus,
      currentPulseStatus,
      hoursDiscrepancy,
      isSaved: savedIds.has(venue.id),
      friendsPresent,
      distanceMeters: userLocation ? haversineDistanceMeters(userLocation, { lat: venue.latitude, lng: venue.longitude }) : undefined,
    };
  });

  // Search always searches everything, even in NOW mode — you should always be able to
  // find a specific place by name, even if it has no live PULSE data yet.
  if (!q && coverageMode === "NOW") {
    results = results.filter((v) => v.coverageState !== "DIRECTORY");
  }

  return NextResponse.json({ venues: results, newlyConfirmedSignals, newlyUnlockedBadges });
}
