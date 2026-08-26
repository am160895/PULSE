import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { getVenueById, listRecentRollupsForVenue, listRecentRollupsForVenues, listVenues } from "@/lib/data/repository";
import { computeVenueState } from "@/lib/pulse/composeVenue";
import { nightlifeDayParts } from "@/lib/time/zoned";
import { NIGHTLIFE_DAY_BOUNDARY_HOUR, ROLLUP_LOOKBACK_NIGHTS } from "@/config/constants";

export interface NeighborhoodBenchmark {
  averageScore: number;
  venueCount: number;
}

/**
 * GET-only, like every /api/owner/** route — owners can never write PULSE data through
 * this feature, only read it. The membership check below (ownedVenueIds.has(id)) is what
 * actually stops Owner A from reading Owner B's dashboard by editing the URL id; nothing
 * else in this route does that job.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  if (!owner.ownedVenueIds.has(id)) {
    return NextResponse.json({ error: "Not authorized for this venue" }, { status: 403 });
  }

  const venue = await getVenueById(id);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const now = new Date();
  const [state, recentRollups, allVenues] = await Promise.all([
    computeVenueState(venue, now),
    listRecentRollupsForVenue(venue.id, now),
    listVenues(),
  ]);

  // Same-neighborhood, same-nightlife-weekday average — a low-traffic dashboard query,
  // not a hot path, so a simple two-step JS aggregation is fine (no new SQL view).
  const neighbors = allVenues.filter((v) => v.id !== venue.id && v.isActive && v.neighborhood === venue.neighborhood);
  const nightlifeDayOfWeek = nightlifeDayParts(now, venue.timezone, NIGHTLIFE_DAY_BOUNDARY_HOUR).nightlifeDayOfWeek;
  const neighborRollups = await listRecentRollupsForVenues(
    neighbors.map((v) => v.id),
    now
  );
  const neighborAverages: number[] = [];
  for (const rollups of neighborRollups.values()) {
    const sameNight = rollups.filter((r) => r.nightlifeDayOfWeek === nightlifeDayOfWeek).slice(0, ROLLUP_LOOKBACK_NIGHTS);
    if (sameNight.length === 0) continue;
    neighborAverages.push(sameNight.reduce((sum, r) => sum + r.avgPulseScore, 0) / sameNight.length);
  }
  const neighborhoodBenchmark: NeighborhoodBenchmark | null =
    neighborAverages.length > 0
      ? {
          averageScore: Math.round(neighborAverages.reduce((a, b) => a + b, 0) / neighborAverages.length),
          venueCount: neighborAverages.length,
        }
      : null;

  return NextResponse.json({
    venue,
    currentPulse: state.pulse,
    vsTypical: state.vsTypical,
    recentRollups,
    neighborhoodBenchmark,
  });
}
