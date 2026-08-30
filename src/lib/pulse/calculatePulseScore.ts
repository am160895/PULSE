import type {
  PulseReasonComponent,
  PulseResult,
  Venue,
  VenueEvent,
  VenueHourlyBaseline,
  VenueHours,
  VenueReport,
  VenueSignalSnapshot,
} from "@/types";
import {
  SCORE_WEIGHTS_LOW_DATA,
  SCORE_WEIGHTS_HIGH_DATA,
  SCORE_SMOOTHING_BASE_RETENTION,
  SCORE_SMOOTHING_MIN_RETENTION,
  TRUST_SCORE_DEFAULT,
} from "@/config/constants";
import { calculateLiveReportSignal } from "./signals/liveReports";
import { calculateHistoricalSignal } from "./signals/historicalBaseline";
import { calculateTrendSignal } from "./signals/trend";
import { calculateEventSignal } from "./signals/eventBoost";
import { calculateFriendActivitySignal } from "./signals/friendActivity";
import { calculateOpennessSignal } from "./signals/timeDecay";
import { calculateConfidenceSignal, calculateFreshness } from "./signals/confidence";
import { estimateExpectedPeak } from "./signals/peak";
import { estimateWaitFromHistorical, estimateWaitFromReports } from "./waitEstimate";
import { pulseLabelForScore } from "./labels";

export interface CalculatePulseScoreInput {
  venue: Venue;
  now: Date;
  reports: VenueReport[]; // pre-filtered to this venue; any age, function handles decay/expiry
  baselines: VenueHourlyBaseline[]; // pre-filtered to this venue
  events: VenueEvent[]; // pre-filtered to this venue
  friendsPresentCount: number;
  history: VenueSignalSnapshot[]; // pre-filtered to this venue, prior snapshots
  trustScores: Map<string, number>;
  /** venue.hours with any special-hours override for today/yesterday already applied —
   * see lib/venues/specialHours.ts's buildEffectiveHours. Callers that haven't computed
   * this yet (no special hours in play) can just pass venue.hours itself. */
  effectiveHours: VenueHours[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mostRecentScore(history: VenueSignalSnapshot[]): number | null {
  if (history.length === 0) return null;
  return [...history].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  )[0].pulseScore;
}

export function calculatePulseScore(input: CalculatePulseScoreInput): PulseResult {
  const { venue, now, reports, baselines, events, friendsPresentCount, history, trustScores, effectiveHours } = input;

  const liveReportSignal = calculateLiveReportSignal({
    reports,
    now,
    trustScores,
    defaultTrust: TRUST_SCORE_DEFAULT,
  });
  const historicalSignal = calculateHistoricalSignal(baselines, now, venue.timezone);
  const trendSignal = calculateTrendSignal(history, now);
  const eventSignal = calculateEventSignal(events, now);
  const friendSignal = calculateFriendActivitySignal(friendsPresentCount);
  const opennessSignal = calculateOpennessSignal(effectiveHours, now, venue.timezone);
  const confidenceSignal = calculateConfidenceSignal({
    weightedReportCount: liveReportSignal.weightedCount,
    agreementScore: liveReportSignal.agreementScore,
    rawReportCount: liveReportSignal.rawCount,
    verifiedRatio: liveReportSignal.verifiedRatio,
    historicalSampleCount: historicalSignal.sampleCount,
  });

  // Dynamic weighting: interpolate between a low-data regime (historical baseline
  // dominates) and a high-data regime (live reports + trend dominate) by how much
  // live-report confidence exists. Trend is *derived from* report history, so it's
  // interpolated the same way — it can't independently double-count the same evidence.
  // A single fixed weight table can only satisfy "sparse -> baseline matters more"
  // OR "strong -> baseline matters less", not both; interpolating satisfies both.
  const reportFactor = confidenceSignal.reportConfidenceFactor;
  const weights = {
    liveReports: lerp(SCORE_WEIGHTS_LOW_DATA.liveReports, SCORE_WEIGHTS_HIGH_DATA.liveReports, reportFactor),
    trend: lerp(SCORE_WEIGHTS_LOW_DATA.trend, SCORE_WEIGHTS_HIGH_DATA.trend, reportFactor),
    historical: lerp(SCORE_WEIGHTS_LOW_DATA.historical, SCORE_WEIGHTS_HIGH_DATA.historical, reportFactor),
    event: lerp(SCORE_WEIGHTS_LOW_DATA.event, SCORE_WEIGHTS_HIGH_DATA.event, reportFactor),
    friendActivity: lerp(SCORE_WEIGHTS_LOW_DATA.friendActivity, SCORE_WEIGHTS_HIGH_DATA.friendActivity, reportFactor),
  };

  // Falls back to the historical score ONLY for display purposes (the "components"
  // breakdown below needs something to show under "Live reports" — see there). The blend
  // math must NOT use this fallback: historicalScore already has its own weighted slot,
  // and reusing it here too would silently double-count it under the liveReports weight
  // whenever there are zero live reports, inflating historical's real influence on the
  // final score by however much SCORE_WEIGHTS_*.liveReports happens to be.
  const hasLiveReports = liveReportSignal.reportScore !== null;
  const reportComponentValue = liveReportSignal.reportScore ?? historicalSignal.historicalScore;

  const totalWeight =
    (hasLiveReports ? weights.liveReports : 0) + weights.trend + weights.historical + weights.event + weights.friendActivity;

  const rawBlend =
    ((hasLiveReports ? weights.liveReports * liveReportSignal.reportScore! : 0) +
      weights.trend * trendSignal.trendComponentScore +
      weights.historical * historicalSignal.historicalScore +
      weights.event * eventSignal.eventComponentScore +
      weights.friendActivity * friendSignal.friendComponentScore) /
    totalWeight;

  // Openness is a multiplicative gate on the final blend, not another averaged
  // component: a naive weighted average would let a closed venue still show a
  // moderate score on the strength of its historical baseline alone.
  const gatedScore = rawBlend * opennessSignal.opennessFactor;

  let finalScore: number;
  if (!opennessSignal.isOpenNow) {
    finalScore = 0;
  } else {
    const previous = mostRecentScore(history);
    if (previous === null) {
      finalScore = gatedScore;
    } else {
      const confidenceFactor = clamp(confidenceSignal.confidenceScore / 100, 0, 1);
      const retention =
        SCORE_SMOOTHING_BASE_RETENTION -
        (SCORE_SMOOTHING_BASE_RETENTION - SCORE_SMOOTHING_MIN_RETENTION) * confidenceFactor;
      finalScore = previous * retention + gatedScore * (1 - retention);
    }
  }
  finalScore = Math.round(clamp(finalScore, 0, 100));

  const waitEstimate =
    estimateWaitFromReports(liveReportSignal.weighted) ??
    estimateWaitFromHistorical(historicalSignal.historicalWaitScore);

  // Computed regardless of whether the venue is open right now — a closed venue still has
  // a meaningful "typical peak" to show ("Closed · Typical Friday peak: 11 PM"), and the
  // spec's closed-venue display explicitly wants this. Only the live score itself is gated.
  const expectedPeak = estimateExpectedPeak(baselines, now, venue.timezone, confidenceSignal.confidenceLabel);

  const freshness = calculateFreshness(liveReportSignal.freshestAgeMinutes);

  const components: PulseReasonComponent[] = [];
  // Omitted (not shown as a 0%-weighted, misleadingly-valued row) when there are no live
  // reports — reportComponentValue would otherwise just be silently restating the
  // historical score under a "Live reports" label, which is exactly the kind of fabricated
  // precision this app's honesty principle rules out.
  if (hasLiveReports) {
    components.push({
      key: "liveReports",
      label: `Live reports · ${Math.round((weights.liveReports / totalWeight) * 100)}% weight`,
      value: Math.round(reportComponentValue),
    });
  }
  components.push(
    {
      key: "historical",
      label: `Typical for this time · ${Math.round((weights.historical / totalWeight) * 100)}% weight`,
      value: Math.round(historicalSignal.historicalScore),
    },
    {
      key: "trend",
      label: `Momentum · ${Math.round((weights.trend / totalWeight) * 100)}% weight`,
      value: Math.round(trendSignal.trendComponentScore),
    }
  );
  if (eventSignal.activeEvent) {
    components.push({ key: "event", label: `Event: ${eventSignal.activeEvent.name}`, value: Math.round(eventSignal.eventComponentScore) });
  }
  if (friendsPresentCount > 0) {
    components.push({ key: "friends", label: `${friendsPresentCount} friend(s) here`, value: Math.round(friendSignal.friendComponentScore) });
  }

  const explanation = buildExplanation({
    isOpenNow: opennessSignal.isOpenNow,
    reportCount: liveReportSignal.rawCount,
    hasEvent: !!eventSignal.activeEvent,
    trend: trendSignal.trendDirection,
    confidenceLabel: confidenceSignal.confidenceLabel,
  });

  return {
    pulseScore: finalScore,
    pulseLabel: opennessSignal.isOpenNow ? pulseLabelForScore(finalScore) : "VERY_QUIET",
    confidenceScore: Math.round(confidenceSignal.confidenceScore),
    confidenceLabel: confidenceSignal.confidenceLabel,
    freshness,
    trend: trendSignal.trendDirection,
    trendDeltaLast30Min: Math.round(trendSignal.deltaLast30Min),
    expectedPeak,
    waitEstimate: opennessSignal.isOpenNow ? waitEstimate : null,
    components,
    explanation,
  };
}

function buildExplanation(input: {
  isOpenNow: boolean;
  reportCount: number;
  hasEvent: boolean;
  trend: string;
  confidenceLabel: string;
}): string {
  if (!input.isOpenNow) return "This venue is currently closed.";

  const parts: string[] = [];
  if (input.reportCount > 0) {
    parts.push(`${input.reportCount} recent report${input.reportCount === 1 ? "" : "s"}`);
  } else {
    parts.push("no live reports yet — based on typical activity for this day and time");
  }
  if (input.hasEvent) parts.push("an event tonight");
  if (input.trend === "RISING_FAST" || input.trend === "RISING") parts.push("rising over the last 30 minutes");
  if (input.trend === "FALLING_FAST" || input.trend === "FALLING") parts.push("falling over the last 30 minutes");

  const base = `Based on ${parts.join(", ")}.`;
  if (input.confidenceLabel === "LOW") return `${base} Based mostly on typical activity for this time — treat this as an estimate.`;
  return base;
}
