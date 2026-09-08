import type { FreshnessLabel, WaitEstimate } from "@/types";

export type InformationValueReasonCode =
  | "NO_RECENT_SIGNAL"
  | "STALE_HIGH_DEMAND"
  | "WAIT_UNKNOWN"
  | "CONFLICTING_SIGNAL"
  | "LOW_SOURCE_DIVERSITY";

export interface InformationValueResult {
  valueScore: number; // 0-100
  reasonCode: InformationValueReasonCode;
}

export interface InformationValueInput {
  pulseScore: number;
  freshness: FreshnessLabel;
  waitEstimate: WaitEstimate | null;
  /** pulse.components' "historical" value — reused, not recomputed. How busy this venue
   * typically is at this exact day/hour, independent of whether anyone's confirmed it
   * tonight. */
  historicalDemandScore: number;
  /** venue.signalHealth.sourceDiversityScore/agreementScore — real fields, not placeholders. */
  sourceDiversityScore: number;
  agreementScore: number;
}

const STALE_HIGH_DEMAND_MIN_SCORE = 65;
const WAIT_UNKNOWN_MIN_PULSE_SCORE = 45;
const CONFLICTING_SIGNAL_MAX_AGREEMENT = 0.5;
const LOW_SOURCE_DIVERSITY_MAX = 0.34;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Ranks "how much would one more real signal here actually help" — the same data every
 * other page already has, no new query. Returns null when there's nothing genuinely
 * information-poor about this venue right now (excluded from the "needs a signal" section
 * entirely, not shown with a manufactured low score).
 */
export function calculateInformationValue(input: InformationValueInput): InformationValueResult | null {
  const { pulseScore, freshness, waitEstimate, historicalDemandScore, sourceDiversityScore, agreementScore } = input;
  const noRecentSignal = freshness === "TYPICAL" || freshness === "ESTIMATED";

  // STALE_HIGH_DEMAND is the more specific, more interesting version of "no recent
  // signal" (a normally-BUSY place going unconfirmed matters more than a normally-quiet
  // one) — checked before the general case, not after, or it would never be reachable.
  let reasonCode: InformationValueReasonCode | null = null;
  if (noRecentSignal && historicalDemandScore >= STALE_HIGH_DEMAND_MIN_SCORE) reasonCode = "STALE_HIGH_DEMAND";
  else if (noRecentSignal) reasonCode = "NO_RECENT_SIGNAL";
  else if (waitEstimate === null && pulseScore >= WAIT_UNKNOWN_MIN_PULSE_SCORE) reasonCode = "WAIT_UNKNOWN";
  else if (agreementScore < CONFLICTING_SIGNAL_MAX_AGREEMENT) reasonCode = "CONFLICTING_SIGNAL";
  else if (sourceDiversityScore < LOW_SOURCE_DIVERSITY_MAX) reasonCode = "LOW_SOURCE_DIVERSITY";

  if (reasonCode === null) return null;

  // Higher when confidence is thin AND the place is plausibly worth knowing about (a
  // busy-typically venue with no live signal is more valuable to confirm than a quiet one).
  const confidenceGap = 1 - clamp01((sourceDiversityScore + agreementScore) / 2);
  const valueScore = Math.round(clamp01(confidenceGap * 0.55 + clamp01(historicalDemandScore / 100) * 0.45) * 100);

  return { valueScore, reasonCode };
}
