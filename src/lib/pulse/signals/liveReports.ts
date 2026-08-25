import type { CrowdLevel, EnergyLevel, VenueReport } from "@/types";
import {
  REPORT_DECAY_HALF_LIFE_MINUTES,
  REPORT_IRRELEVANT_AFTER_MINUTES,
} from "@/config/constants";

const CROWD_BASE_VALUE: Record<CrowdLevel, number> = {
  EMPTY: 5,
  QUIET: 22,
  MODERATE: 48,
  BUSY: 72,
  PACKED: 92,
};

const ENERGY_ADJUSTMENT: Record<EnergyLevel, number> = {
  LOW: -6,
  CHILL: -2,
  GOOD: 0,
  HIGH: 4,
  VERY_HIGH: 7,
};

export interface WeightedReport {
  report: VenueReport;
  ageMinutes: number;
  activityValue: number; // 0-100, this report's implied activity level
  weight: number; // decay * trust * proximity, before normalization
}

/** Exponential decay: weight halves every REPORT_DECAY_HALF_LIFE_MINUTES, floors to 0 past the irrelevance cutoff. */
export function reportTimeDecay(ageMinutes: number): number {
  if (ageMinutes < 0) return 1;
  if (ageMinutes >= REPORT_IRRELEVANT_AFTER_MINUTES) return 0;
  return Math.pow(0.5, ageMinutes / REPORT_DECAY_HALF_LIFE_MINUTES);
}

export function activityValueForReport(crowdLevel: CrowdLevel, energyLevel: EnergyLevel): number {
  const value = CROWD_BASE_VALUE[crowdLevel] + ENERGY_ADJUSTMENT[energyLevel];
  return Math.min(100, Math.max(0, value));
}

export interface LiveReportSignalInput {
  reports: VenueReport[];
  now: Date;
  trustScores: Map<string, number>;
  defaultTrust: number;
}

export interface LiveReportSignalOutput {
  reportScore: number | null; // null = no usable reports
  weightedCount: number; // effective sample size after decay/trust weighting
  rawCount: number; // reports still within the irrelevance window
  verifiedRatio: number; // 0-1
  agreementScore: number; // 0-1, 1 = perfect agreement between reports
  freshestAgeMinutes: number | null;
  weighted: WeightedReport[];
}

export function calculateLiveReportSignal(input: LiveReportSignalInput): LiveReportSignalOutput {
  const { reports, now, trustScores, defaultTrust } = input;

  const weighted: WeightedReport[] = reports
    .map((report) => {
      const ageMinutes = (now.getTime() - new Date(report.createdAt).getTime()) / 60_000;
      const decay = reportTimeDecay(ageMinutes);
      const trust = trustScores.get(report.userId) ?? defaultTrust;
      const proximity = report.isVerifiedNearby ? 1 : 0.6;
      const activityValue = activityValueForReport(report.crowdLevel, report.energyLevel);
      return { report, ageMinutes, activityValue, weight: decay * trust * proximity };
    })
    .filter((w) => w.ageMinutes < REPORT_IRRELEVANT_AFTER_MINUTES && w.weight > 0.001);

  if (weighted.length === 0) {
    return {
      reportScore: null,
      weightedCount: 0,
      rawCount: 0,
      verifiedRatio: 0,
      agreementScore: 1,
      freshestAgeMinutes: null,
      weighted: [],
    };
  }

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const reportScore =
    weighted.reduce((sum, w) => sum + w.weight * w.activityValue, 0) / totalWeight;

  const verifiedWeight = weighted
    .filter((w) => w.report.isVerifiedNearby)
    .reduce((sum, w) => sum + w.weight, 0);

  // Agreement: 1 - normalized weighted standard deviation of activity values.
  const variance =
    weighted.reduce((sum, w) => sum + w.weight * Math.pow(w.activityValue - reportScore, 2), 0) /
    totalWeight;
  const stdDev = Math.sqrt(variance);
  const agreementScore = Math.max(0, 1 - stdDev / 45);

  const freshestAgeMinutes = Math.min(...weighted.map((w) => w.ageMinutes));

  return {
    reportScore,
    weightedCount: totalWeight,
    rawCount: weighted.length,
    verifiedRatio: verifiedWeight / totalWeight,
    agreementScore,
    freshestAgeMinutes,
    weighted,
  };
}
