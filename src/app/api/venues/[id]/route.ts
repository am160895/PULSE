import { NextResponse } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById, listSavedVenueIds, listVenues } from "@/lib/data/repository";
import { listVisiblePresenceForViewer } from "@/lib/data/social";
import { computeVenueState } from "@/lib/pulse/composeVenue";
import { haversineDistanceMeters } from "@/lib/geo";

const ALTERNATIVES_RADIUS_METERS = 700;
// computeVenueState() now costs a handful of real Supabase round-trips per venue (it was a
// free in-memory lookup against the local dev store) — capping the candidate pool by
// distance bounds that fan-out regardless of how dense a neighborhood is, rather than
// scoring every venue within radius just to keep the closest few.
const MAX_ALTERNATIVE_CANDIDATES = 10;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const now = new Date();
  const [{ pulse, openState, coverageState }, savedIds, presence, allVenues] = await Promise.all([
    computeVenueState(venue, now),
    listSavedVenueIds(session.profile.id),
    listVisiblePresenceForViewer(session.profile.id, now),
    listVenues(),
  ]);
  const friendsPresent = presence.filter((p) => p.venueId === venue.id);

  const result: VenueWithPulse = { ...venue, pulse, openState, coverageState, isSaved: savedIds.has(venue.id), friendsPresent };

  // Surfaced on the venue page when this venue is falling or has a long wait (§63).
  const nearby = allVenues
    .filter((v) => v.id !== venue.id)
    .map((v) => ({ v, distance: haversineDistanceMeters({ lat: venue.latitude, lng: venue.longitude }, { lat: v.latitude, lng: v.longitude }) }))
    .filter(({ distance }) => distance <= ALTERNATIVES_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_ALTERNATIVE_CANDIDATES);

  const alternatives: VenueWithPulse[] = (
    await Promise.all(
      nearby.map(async ({ v, distance }) => {
        const state = await computeVenueState(v, now);
        return { ...v, ...state, isSaved: savedIds.has(v.id), distanceMeters: distance };
      })
    )
  )
    .filter((v) => v.pulse.pulseScore > pulse.pulseScore)
    .sort((a, b) => b.pulse.pulseScore - a.pulse.pulseScore)
    .slice(0, 3);

  return NextResponse.json({ venue: result, alternatives });
}
