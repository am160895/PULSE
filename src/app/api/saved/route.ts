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
  const states = await computeVenueStatesBatch(savedVenues, now, session.profile.id);
  const venues: VenueWithPulse[] = savedVenues.map((venue) => {
    const state = states.get(venue.id)!;
    return {
      ...venue,
      pulse: state.pulse,
      openState: state.openState,
      coverageState: state.coverageState,
      openStatus: state.openStatus,
      currentPulseStatus: state.currentPulseStatus,
      hoursDiscrepancy: state.hoursDiscrepancy,
      vsTypical: state.vsTypical,
      isSaved: true,
    };
  });

  return NextResponse.json({ venues });
}
