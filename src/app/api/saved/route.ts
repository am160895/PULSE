import { NextResponse } from "next/server";
import type { VenueWithPulse } from "@/types";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById, listSavedVenueIds } from "@/lib/data/repository";
import { computeVenueState } from "@/lib/pulse/composeVenue";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const savedIds = await listSavedVenueIds(session.profile.id);
  const savedVenues = (await Promise.all([...savedIds].map((id) => getVenueById(id)))).filter(
    (v): v is NonNullable<typeof v> => !!v
  );
  const venues: VenueWithPulse[] = await Promise.all(
    savedVenues.map(async (venue) => ({ ...venue, ...(await computeVenueState(venue, now)), isSaved: true }))
  );

  return NextResponse.json({ venues });
}
