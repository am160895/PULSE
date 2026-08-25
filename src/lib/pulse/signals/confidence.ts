import type { ConfidenceLabel, FreshnessLabel } from "@/types";
import { CONFIDENCE_LABEL_BANDS, FRESHNESS_BANDS_MINUTES } from "@/config/constants";

export interface ConfidenceSignalInput {
  weightedReportCount: number;
  agreementScore: number; // 0-1
  /** How many distinct reports fed agreementScore — agreement is meaningless with only one. */
  rawReportCount: number;
  verifiedRatio: number; // 0-1
  historicalSampleCount: number;
}

export interface ConfidenceSignalOutput {
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  /** 0-1: how much weight live reports (and the trend derived from them) should carry, before base weights are applied. */
  reportConfidenceFactor: number;
}

const FULL_CONFIDENCE_REPORT_COUNT = 4;
const FULL_SAMPLE_HISTORICAL_COUNT = 30;
const HISTORICAL_ONLY_CONFIDENCE_CAP = 55; // never call it HIGH confidence on history alone

export function calculateConfidenceSignal(input: ConfidenceSignalInput): ConfidenceSignalOutput {
  const { weightedReportCount, agreementScore, rawReportCount, verifiedRatio, historicalSampleCount } = input;

  const reportConfidenceFactor = clamp01(weightedReportCount / FULL_CONFIDENCE_REPORT_COUNT);
  const historicalSampleFactor = clamp01(historicalSampleCount / FULL_SAMPLE_HISTORICAL_COUNT);

  let confidenceScore: number;
  if (weightedReportCount === 0) {
    confidenceScore = Math.min(HISTORICAL_ONLY_CONFIDENCE_CAP, 15 + historicalSampleFactor * 40);
  } else {
    // Agreement is only a meaningful concept with 2+ independent reports — a single
    // report trivially "agrees with itself" (variance 0, agreementScore 1), which would
    // otherwise hand a lone, unverified, low-trust report a full 25-point confidence
    // bonus it hasn't earned.
    const agreementContribution = rawReportCount >= 2 ? agreementScore * 25 : 0;
    confidenceScore =
      25 +
      reportConfidenceFactor * 35 +
      agreementContribution +
      verifiedRatio * 15;
  }

  confidenceScore = clamp(confidenceScore, 0, 100);

  const confidenceLabel =
    CONFIDENCE_LABEL_BANDS.find((band) => confidenceScore >= band.min)?.label ?? "LOW";

  return { confidenceScore, confidenceLabel, reportConfidenceFactor };
}

export function calculateFreshness(freshestAgeMinutes: number | null): FreshnessLabel {
  if (freshestAgeMinutes === null) return "TYPICAL";
  if (freshestAgeMinutes <= FRESHNESS_BANDS_MINUTES.live) return "LIVE";
  if (freshestAgeMinutes <= FRESHNESS_BANDS_MINUTES.recent) return "RECENT";
  if (freshestAgeMinutes <= FRESHNESS_BANDS_MINUTES.estimated) return "ESTIMATED";
  return "TYPICAL";
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
