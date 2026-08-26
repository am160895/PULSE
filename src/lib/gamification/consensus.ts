import type { ConfirmedSignal, TrendDirection, Venue, VenueReport } from "@/types";
import {
  SIGNAL_CONFIRMATION_MAX_AGE_MINUTES,
  SIGNAL_CONFIRMATION_MAX_VALUE_DELTA,
  SIGNAL_CONFIRMATION_MIN_AGE_MINUTES,
  SIGNAL_CONFIRMATION_MIN_CORROBORATING_REPORTS,
} from "@/config/constants";
import { activityValueForReport } from "@/lib/pulse/signals/liveReports";
import { awardXp } from "./xp";

export interface ConsensusCheck {
  confirmed: boolean;
  corroboratingCount: number;
}

/**
 * Per-report, relative confirmation: did reports that arrived AFTER this one land close
 * to its own implied activity value? Deliberately distinct from liveReports.ts's
 * venue-wide agreementScore (a weighted-stddev aggregate across every current report,
 * answering "how much does the venue agree right now") — this answers a narrower,
 * directly explainable question about one specific report, reusing the one shared
 * primitive (activityValueForReport) rather than the aggregate.
 */
export function wasReportConfirmed(report: VenueReport, laterReports: VenueReport[]): ConsensusCheck {
  const reportValue = activityValueForReport(report.crowdLevel, report.energyLevel);
  const reportTime = new Date(report.createdAt).getTime();
  const corroborating = laterReports.filter(
    (r) =>
      r.id !== report.id &&
      r.userId !== report.userId &&
      new Date(r.createdAt).getTime() > reportTime &&
      Math.abs(activityValueForReport(r.crowdLevel, r.energyLevel) - reportValue) <= SIGNAL_CONFIRMATION_MAX_VALUE_DELTA
  );
  return { confirmed: corroborating.length >= SIGNAL_CONFIRMATION_MIN_CORROBORATING_REPORTS, corroboratingCount: corroborating.length };
}

/**
 * Checks whether any of the viewer's OWN reports at this venue, aged into the
 * confirmation window (20-45 min old), were directionally confirmed by later reports —
 * and if so, awards SIGNAL_CONFIRMED XP (idempotent via awardXp's unique-index guard, so
 * calling this on every subsequent fetch is safe and cheap).
 *
 * Piggybacks on scoring's already-fetched `reports` array — zero extra Supabase queries.
 * Called from composeVenue.ts on every score computation a viewer triggers (venue detail
 * poll, map/list load): this is the only "later" trigger point available without any
 * cron/background-job infrastructure anywhere in this app. Accepted gap, not silently
 * ignored: if the reporting user never reopens PULSE (any screen) within the window, that
 * confirmation is never evaluated and never awarded — the real fix is a scheduled sweep
 * independent of any request, out of scope until this app has cron infrastructure at all.
 */
export async function evaluateOwnReportsForConsensus(
  viewerId: string,
  venue: Venue,
  reports: VenueReport[],
  now: Date,
  trendAtConfirmation: TrendDirection
): Promise<ConfirmedSignal[]> {
  const candidates = reports.filter((r) => {
    if (r.userId !== viewerId) return false;
    const ageMinutes = (now.getTime() - new Date(r.createdAt).getTime()) / 60_000;
    return ageMinutes >= SIGNAL_CONFIRMATION_MIN_AGE_MINUTES && ageMinutes <= SIGNAL_CONFIRMATION_MAX_AGE_MINUTES;
  });
  if (candidates.length === 0) return [];

  const confirmed: ConfirmedSignal[] = [];
  for (const report of candidates) {
    const { confirmed: ok, corroboratingCount } = wasReportConfirmed(report, reports);
    if (!ok) continue;
    const result = await awardXp({
      userId: viewerId,
      rewardType: "SIGNAL_CONFIRMED",
      sourceId: report.id,
      venueId: venue.id,
      neighborhood: venue.neighborhood,
      metadata: { confirmedReportId: report.id, corroboratingCount, trendAtConfirmation },
    });
    if (result.awarded) confirmed.push({ reportId: report.id, venueId: venue.id, xpAwarded: result.xpAmount });
  }
  return confirmed;
}
