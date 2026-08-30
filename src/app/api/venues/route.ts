import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { listSavedVenueIds, listVenues, listVenuesInBounds, searchVenues } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";
import { calculateMoveScore } from "@/lib/pulse/moveScore";
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

  const results: VenueWithPulse[] = venues.map((venue) => {
    const { pulse, openState, coverageState, openStatus, currentPulseStatus, hoursDiscrepancy, vsTypical } = states.get(venue.id)!;
    const friendsPresent = visiblePresence.filter((p) => p.venueId === venue.id);
    const distanceMeters = userLocation ? haversineDistanceMeters(userLocation, { lat: venue.latitude, lng: venue.longitude }) : undefined;
    return {
      ...venue,
      pulse,
      move: calculateMoveScore({ pulseScore: pulse.pulseScore, confidenceScore: pulse.confidenceScore, trend: pulse.trend, waitEstimate: pulse.waitEstimate, currentPulseStatus, distanceMeters }),
      openState,
      coverageState,
      openStatus,
      currentPulseStatus,
      hoursDiscrepancy,
      vsTypical,
      isSaved: savedIds.has(venue.id),
      friendsPresent,
      distanceMeters,
    };
  });

  return NextResponse.json({ venues: results, newlyConfirmedSignals, newlyUnlockedBadges });
}
