import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { submitReport } from "@/lib/reports/submitReport";
import { detectRepetitivePattern } from "@/lib/reports/trust";
import {
  createReport,
  getLastReportByUserForVenue,
  getVenueById,
  hasReportSinceForVenue,
  recentReportValuesByUser,
} from "@/lib/data/repository";
import { getTrustScore, saveTrustScore } from "@/lib/data/social";
import { computePulseForVenue } from "@/lib/pulse/composeVenue";
import { buildImpactMessage } from "@/lib/pulse/impactMessage";
import { awardXpForReport } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";
import { SupabaseQueryError } from "@/lib/supabase/unwrap";
import { FIRST_REPORT_TONIGHT_WINDOW_HOURS } from "@/config/constants";

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

  // Checked BEFORE creating the report, so the report about to be created never counts as
  // its own "someone already reported tonight" evidence — the FIRST_REPORT_TONIGHT bonus
  // rewards genuinely being first, not a self-referential race.
  const tonightCutoff = new Date(now.getTime() - FIRST_REPORT_TONIGHT_WINDOW_HOURS * 3_600_000).toISOString();
  const isFirstReportTonight = !(await hasReportSinceForVenue(venueId, tonightCutoff));

  const before = await computePulseForVenue(venue, now);

  let report;
  try {
    report = await createReport({ venueId, userId: session.profile.id, ...result.report });
  } catch (err) {
    // The app-layer cooldown check above isn't atomic with the insert — a race past it
    // (two near-simultaneous requests) can still hit the DB's 25-minute exclusion
    // constraint (23P01). Surface the same friendly cooldown error instead of a bare 500.
    if (err instanceof SupabaseQueryError && err.code === "23P01") {
      return NextResponse.json({ error: "You already reported this venue recently. Try again shortly." }, { status: 429 });
    }
    throw err;
  }

  await saveTrustScore({ ...trust, reportsSubmitted: trust.reportsSubmitted + 1, updatedAt: now.toISOString() });

  const recentPattern = await recentReportValuesByUser(session.profile.id);
  const suspicious = detectRepetitivePattern(recentPattern);

  const xp = await awardXpForReport(session.profile.id, report, venue, isFirstReportTonight);
  const badgesUnlocked = await evaluateBadges(session.profile.id, now);

  const after = await computePulseForVenue(venue, now);
  const impact = buildImpactMessage(before, after);

  return NextResponse.json({
    ok: true,
    reportId: report.id,
    pulse: after,
    flaggedForReview: suspicious,
    xp: {
      totalXpAwarded: xp.totalXpAwarded,
      totalXp: xp.finalTotalXp,
      level: xp.finalLevel,
      leveledUp: xp.leveledUp,
    },
    badgesUnlocked,
    impactMessage: impact,
    message: "Live signal added",
  });
}
