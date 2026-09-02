import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { listSavedVenueIds, listVenues, listVenuesInBounds } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";
import { calculateMoveScore } from "@/lib/pulse/moveScore";
import { pickDecision } from "@/lib/pulse/decide";
import { boundingBoxFromCenter, haversineDistanceMeters } from "@/lib/geo";
import { BEST_BET_MAX_DISTANCE_METERS } from "@/config/constants";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const userLocation = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

  const now = new Date();
  // With a known location, the query itself is scoped to the max-distance box instead of
  // pulling every active venue citywide — same reasoning as the alternatives cap on
  // /api/venues/[id]. Without one there's no way to know which subset is relevant, so that
  // branch still needs the full active set.
  const allVenues = userLocation
    ? await listVenuesInBounds(boundingBoxFromCenter(userLocation, BEST_BET_MAX_DISTANCE_METERS))
    : await listVenues();

  // Exact-radius filter, not just the bounding box's corners — same reasoning as
  // listVenuesInBounds' own belt-and-suspenders filter.
  const candidates = userLocation
    ? allVenues.filter((v) => haversineDistanceMeters(userLocation, { lat: v.latitude, lng: v.longitude }) <= BEST_BET_MAX_DISTANCE_METERS)
    : allVenues;

  const [states, savedIds, visiblePresence] = await Promise.all([
    computeVenueStatesBatch(candidates, now, session.profile.id),
    listSavedVenueIds(session.profile.id),
    listVisiblePresenceForViewer(session.profile.id, now),
  ]);

  const venues: VenueWithPulse[] = candidates.map((venue) => {
    const state = states.get(venue.id)!;
    const distanceMeters = userLocation ? haversineDistanceMeters(userLocation, { lat: venue.latitude, lng: venue.longitude }) : undefined;
    return {
      ...venue,
      pulse: state.pulse,
      move: calculateMoveScore({
        pulseScore: state.pulse.pulseScore,
        confidenceScore: state.pulse.confidenceScore,
        trend: state.pulse.trend,
        waitEstimate: state.pulse.waitEstimate,
        currentPulseStatus: state.currentPulseStatus,
        distanceMeters,
      }),
      openState: state.openState,
      coverageState: state.coverageState,
      openStatus: state.openStatus,
      currentPulseStatus: state.currentPulseStatus,
      hoursDiscrepancy: state.hoursDiscrepancy,
      vsTypical: state.vsTypical,
      isSaved: savedIds.has(venue.id),
      friendsPresent: visiblePresence.filter((p) => p.venueId === venue.id),
      distanceMeters,
    };
  });

  return NextResponse.json(pickDecision(venues));
}
