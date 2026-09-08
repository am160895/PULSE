import type { SignalHealth, SignalHealthState, VenueHourlyBaseline, VenueReport } from "@/types";
import { calculateLiveReportSignal } from "./signals/liveReports";
import { calculateHistoricalSignal } from "./signals/historicalBaseline";
import { calculateConfidenceSignal, calculateFreshness } from "./signals/confidence";

const MIN_LIVE_CONTRIBUTORS = 2;
const MIN_LIVE_AGREEMENT = 0.6;
// Below this, a venue that reads confidenceLabel=HIGH on raw confidenceScore alone still
// isn't allowed to show as HIGH here — one trusted, verified, but SOLE reporter can
// otherwise clear the confidenceScore bar on trust/verification alone with nobody else
// around to agree or disagree.
const MIN_HIGH_SOURCE_DIVERSITY = 0.5;

export interface DeriveSignalHealthInput {
  reports: VenueReport[];
  baselines: VenueHourlyBaseline[];
  friendsPresentCount: number;
  now: Date;
  timezone: string;
  trustScores: Map<string, number>;
  defaultTrust: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Deliberately recomputes calculateLiveReportSignal/calculateHistoricalSignal rather than
 * threading their output out of calculatePulseScore — both are pure, in-memory
 * computations over small per-venue arrays (no new DB round-trip), so recomputing costs
 * nothing meaningful and keeps calculatePulseScore's existing signature/contract (and its
 * tests) completely untouched.
 */
export function deriveSignalHealth(input: DeriveSignalHealthInput): SignalHealth {
  const { reports, baselines, friendsPresentCount, now, timezone, trustScores, defaultTrust } = input;

  const liveReportSignal = calculateLiveReportSignal({ reports, now, trustScores, defaultTrust });
  const historicalSignal = calculateHistoricalSignal(baselines, now, timezone);
  const confidenceSignal = calculateConfidenceSignal({
    weightedReportCount: liveReportSignal.weightedCount,
    agreementScore: liveReportSignal.agreementScore,
    rawReportCount: liveReportSignal.rawCount,
    verifiedRatio: liveReportSignal.verifiedRatio,
    historicalSampleCount: historicalSignal.sampleCount,
  });
  const freshness = calculateFreshness(liveReportSignal.freshestAgeMinutes);

  const independentContributors = new Set(liveReportSignal.weighted.map((w) => w.report.userId)).size;
  const verifiedContributors = new Set(
    liveReportSignal.weighted.filter((w) => w.report.isVerifiedNearby).map((w) => w.report.userId)
  ).size;

  const sourceDiversityScore = clamp01(
    0.6 * clamp01(independentContributors / 3) +
      0.25 * clamp01(verifiedContributors / 2) +
      0.15 * (friendsPresentCount > 0 ? 1 : 0)
  );

  const confidenceLabel =
    confidenceSignal.confidenceLabel === "HIGH" && sourceDiversityScore < MIN_HIGH_SOURCE_DIVERSITY
      ? "MEDIUM"
      : confidenceSignal.confidenceLabel;

  const state = deriveState({
    freshness,
    independentContributors,
    agreementScore: liveReportSignal.agreementScore,
    hasBaselineData: historicalSignal.sampleCount > 0,
  });

  return {
    state,
    independentContributors,
    verifiedContributors,
    agreementScore: liveReportSignal.agreementScore,
    sourceDiversityScore,
    confidenceScore: confidenceSignal.confidenceScore,
    confidenceLabel,
    freshnessMinutes: liveReportSignal.freshestAgeMinutes,
  };
}

function deriveState(input: {
  freshness: ReturnType<typeof calculateFreshness>;
  independentContributors: number;
  agreementScore: number;
  hasBaselineData: boolean;
}): SignalHealthState {
  const { freshness, independentContributors, agreementScore, hasBaselineData } = input;

  if (freshness === "LIVE") {
    return independentContributors >= MIN_LIVE_CONTRIBUTORS && agreementScore >= MIN_LIVE_AGREEMENT ? "LIVE" : "MIXED";
  }
  if (freshness === "RECENT") {
    return independentContributors >= MIN_LIVE_CONTRIBUTORS && agreementScore >= MIN_LIVE_AGREEMENT ? "RECENT" : "MIXED";
  }
  return hasBaselineData ? "EXPECTED" : "INSUFFICIENT";
}
