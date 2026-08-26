import { NextResponse } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById, listSavedVenueIds, listVenues } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueStatesBatch } from "@/lib/pulse/composeVenue";
import { haversineDistanceMeters } from "@/lib/geo";
import { getOwnershipRequest } from "@/lib/data/ownership";

const ALTERNATIVES_RADIUS_METERS = 700;
// computeVenueStatesBatch() still costs real Supabase round-trips (just a fixed handful
// regardless of venue count, not one set per venue) — capping the candidate pool by distance
// keeps the batch itself small rather than scoring every venue within radius just to keep
// the closest few.
const MAX_ALTERNATIVE_CANDIDATES = 10;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const now = new Date();
  const [savedIds, presence, allVenues, myOwnershipRequest] = await Promise.all([
    listSavedVenueIds(session.profile.id),
    listVisiblePresenceForViewer(session.profile.id, now),
    listVenues(),
    getOwnershipRequest(venue.id, session.profile.id),
  ]);
  const friendsPresent = presence.filter((p) => p.venueId === venue.id);

  // Surfaced on the venue page when this venue is falling or has a long wait (§63).
  const nearby = allVenues
    .filter((v) => v.id !== venue.id)
    .map((v) => ({ v, distance: haversineDistanceMeters({ lat: venue.latitude, lng: venue.longitude }, { lat: v.latitude, lng: v.longitude }) }))
    .filter(({ distance }) => distance <= ALTERNATIVES_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_ALTERNATIVE_CANDIDATES);

  // Score the primary venue and every candidate alternative in one batch — same total
  // round-trip cost whether there are 0 or 10 nearby candidates.
  const states = await computeVenueStatesBatch([venue, ...nearby.map((n) => n.v)], now, session.profile.id);
  const { pulse, openState, coverageState, openStatus, currentPulseStatus, hoursDiscrepancy, vsTypical, newlyConfirmedSignals, newlyUnlockedBadges } =
    states.get(venue.id)!;

  const result: VenueWithPulse = {
    ...venue,
    pulse,
    openState,
    coverageState,
    openStatus,
    currentPulseStatus,
    hoursDiscrepancy,
    vsTypical,
    isSaved: savedIds.has(venue.id),
    friendsPresent,
  };

  const alternatives: VenueWithPulse[] = nearby
    .map(({ v, distance }) => {
      const alt = states.get(v.id)!;
      return {
        ...v,
        pulse: alt.pulse,
        openState: alt.openState,
        coverageState: alt.coverageState,
        openStatus: alt.openStatus,
        currentPulseStatus: alt.currentPulseStatus,
        hoursDiscrepancy: alt.hoursDiscrepancy,
        vsTypical: alt.vsTypical,
        isSaved: savedIds.has(v.id),
        distanceMeters: distance,
      };
    })
    .filter((v) => v.pulse.pulseScore > pulse.pulseScore)
    .sort((a, b) => b.pulse.pulseScore - a.pulse.pulseScore)
    .slice(0, 3);

  return NextResponse.json({
    venue: result,
    alternatives,
    newlyConfirmedSignals,
    newlyUnlockedBadges,
    myOwnershipStatus: myOwnershipRequest?.status ?? null,
  });
}
