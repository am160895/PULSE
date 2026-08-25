import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { submitReport } from "@/lib/reports/submitReport";
import { detectRepetitivePattern } from "@/lib/reports/trust";
import {
  createReport,
  getLastReportByUserForVenue,
  getVenueById,
  recentReportValuesByUser,
} from "@/lib/data/repository";
import { getTrustScore, saveTrustScore } from "@/lib/data/social";
import { computePulseForVenue } from "@/lib/pulse/composeVenue";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: venueId } = await params;
  const venue = await getVenueById(venueId);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const now = new Date();
  const [last, trust] = await Promise.all([
    getLastReportByUserForVenue(session.profile.id, venueId),
    getTrustScore(session.profile.id),
  ]);

  const result = submitReport(body, {
    venueLocation: { lat: venue.latitude, lng: venue.longitude },
    lastReportAt: last ? new Date(last.createdAt) : null,
    now,
    trustWeightAtSubmission: trust.trustScore,
    source: "APP",
  });

  if (!result.ok) {
    const status = result.error === "COOLDOWN" ? 429 : 400;
    const message =
      result.error === "COOLDOWN"
        ? `You already reported this venue recently. Try again in ${result.retryAfterMinutes} min.`
        : result.error === "INVALID_INPUT"
          ? result.message
          : "Could not submit report";
    return NextResponse.json({ error: message }, { status });
  }

  await createReport({ venueId, userId: session.profile.id, ...result.report });

  await saveTrustScore({ ...trust, reportsSubmitted: trust.reportsSubmitted + 1, updatedAt: now.toISOString() });

  const recentPattern = await recentReportValuesByUser(session.profile.id);
  const suspicious = detectRepetitivePattern(recentPattern);

  const pulse = await computePulseForVenue(venue, now);
  return NextResponse.json({ ok: true, pulse, flaggedForReview: suspicious });
}
