import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createReport, listVenues } from "@/lib/data/repository";
import { listOtherProfileIds } from "@/lib/data/social";
import { simulateReportsForVenue } from "@/lib/simulation/simulateNight";

/**
 * Dev-only control (spec §41-43): re-runs the demo signal generator against the
 * current clock so the map still feels alive if you're demoing hours after seeding.
 * This feeds fresh rows through the exact same report pipeline scoring reads from —
 * it is not a shortcut that fakes the score directly.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const reporterProfileIds = await listOtherProfileIds(session.profile.id);

  let created = 0;
  for (const venue of await listVenues()) {
    const reports = simulateReportsForVenue({ venue, now, reporterProfileIds, maxReports: 3 });
    for (const r of reports) {
      await createReport({ venueId: venue.id, ...r });
      created++;
    }
  }

  return NextResponse.json({ ok: true, reportsCreated: created });
}
