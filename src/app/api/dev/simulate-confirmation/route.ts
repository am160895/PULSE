import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { backdateReportForDemo, createReport, getReportById, getVenueById } from "@/lib/data/repository";
import { listOtherProfileIds } from "@/lib/data/social";
import { SIGNAL_CONFIRMATION_MIN_AGE_MINUTES, SIGNAL_CONFIRMATION_MIN_CORROBORATING_REPORTS } from "@/config/constants";

const bodySchema = z.object({ reportId: z.string() });

/**
 * Dev-only demo trigger for the delayed-accuracy-reward flow (spec §5/§33): backdates one
 * of the caller's own reports into the confirmation window and adds enough corroborating
 * reports from other users that the next fetch touching this venue (venue detail poll, map
 * load) awards SIGNAL_CONFIRMED. Real confirmation happens the same way organically over
 * the actual 20-45 minute window — this only exists so the flow can be demoed without
 * waiting, matching the existing /api/dev/simulate route's same production guard.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const report = await getReportById(parsed.data.reportId);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.userId !== session.profile.id) {
    return NextResponse.json({ error: "Can only simulate confirmation for your own report" }, { status: 403 });
  }

  const venue = await getVenueById(report.venueId);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const now = new Date();
  const backdatedAt = new Date(now.getTime() - (SIGNAL_CONFIRMATION_MIN_AGE_MINUTES + 5) * 60_000).toISOString();
  await backdateReportForDemo(report.id, backdatedAt);

  const others = (await listOtherProfileIds(session.profile.id)).slice(0, SIGNAL_CONFIRMATION_MIN_CORROBORATING_REPORTS);
  let created = 0;
  for (let i = 0; i < others.length; i++) {
    await createReport({
      venueId: venue.id,
      userId: others[i],
      crowdLevel: report.crowdLevel,
      waitLevel: report.waitLevel,
      energyLevel: report.energyLevel,
      crowdNote: null,
      reportSource: "SIMULATOR",
      isVerifiedNearby: true,
      trustWeightAtSubmission: 0.6,
      createdAt: new Date(new Date(backdatedAt).getTime() + (i + 1) * 60_000).toISOString(),
    });
    created++;
  }

  return NextResponse.json({ ok: true, corroboratingReportsCreated: created });
}
