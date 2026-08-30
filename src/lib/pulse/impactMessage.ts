import type { PulseResult } from "@/types";
import { IMPACT_CONFIDENCE_DELTA_THRESHOLD, IMPACT_SCORE_DELTA_THRESHOLD } from "@/config/constants";

export type ImpactType = "SCORE_MOVED" | "SIGNAL_CONFIRMED" | "LIVE_SIGNAL_ADDED";

export interface ImpactMessage {
  type: ImpactType;
  title: string;
  detail: string;
}

/**
 * Never manufactures impact. A report that didn't materially move either the score or
 * the underlying signal strength still gets an honest, non-inflated message — "sometimes
 * contribution should strengthen the signal rather than the score" is a real, common case,
 * not a fallback to hide. User-facing copy deliberately avoids the word "confidence" (see
 * calculatePulseScore.ts) — "signal strength" carries the same honest meaning.
 */
export function buildImpactMessage(before: PulseResult, after: PulseResult): ImpactMessage {
  const scoreDelta = after.pulseScore - before.pulseScore;
  if (Math.abs(scoreDelta) >= IMPACT_SCORE_DELTA_THRESHOLD) {
    return { type: "SCORE_MOVED", title: "You moved the Pulse", detail: `${before.pulseScore} → ${after.pulseScore}` };
  }

  const confidenceDelta = after.confidenceScore - before.confidenceScore;
  if (confidenceDelta >= IMPACT_CONFIDENCE_DELTA_THRESHOLD) {
    return { type: "SIGNAL_CONFIRMED", title: "Signal confirmed", detail: `Signal strength ${before.confidenceScore} → ${after.confidenceScore}` };
  }

  return { type: "LIVE_SIGNAL_ADDED", title: "Live signal added", detail: "Your report strengthens the signal nearby." };
}
