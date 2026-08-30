import type { CurrentPulseStatus, MoveResult, MoveVerdict, TrendDirection, WaitEstimate } from "@/types";
import {
  MOVE_COOLING_MIN_PULSE_SCORE,
  MOVE_DISTANCE_FREE_METERS,
  MOVE_DISTANCE_MAX_PENALTY,
  MOVE_DISTANCE_PENALTY_PER_METER,
  MOVE_HIGH_LINE_RISK_MINUTES,
  MOVE_NOT_WORTH_TRIP_MAX_SCORE,
  MOVE_PEAKING_MIN_SCORE,
  MOVE_TOO_EARLY_MAX_PULSE_SCORE,
  MOVE_TREND_ADJUSTMENT,
  MOVE_WAIT_PENALTY_BANDS,
} from "@/config/constants";

export const MOVE_VERDICT_TEXT: Record<MoveVerdict, string> = {
  GOOD_MOVE: "Good move",
  PEAKING: "Peaking",
  COOLING: "Cooling",
  HIGH_LINE_RISK: "High line risk",
  TOO_EARLY: "Too early",
  NOT_WORTH_TRIP: "Not worth the trip",
};

export interface MoveScoreInput {
  pulseScore: number;
  confidenceScore: number;
  trend: TrendDirection;
  waitEstimate: WaitEstimate | null;
  currentPulseStatus: CurrentPulseStatus;
  /** Omitted (not just absent-and-zero) when the caller doesn't know the viewer's
   * location — undefined means "don't penalize," never treated as 0m away. */
  distanceMeters?: number;
}

function waitPenalty(waitEstimate: WaitEstimate | null): number {
  if (!waitEstimate) return 0;
  const band = MOVE_WAIT_PENALTY_BANDS.find((b) => waitEstimate.minMinutes >= b.minMinutes);
  return band?.penalty ?? 0;
}

function distancePenalty(distanceMeters: number | undefined): number {
  if (distanceMeters === undefined || distanceMeters <= MOVE_DISTANCE_FREE_METERS) return 0;
  const excess = distanceMeters - MOVE_DISTANCE_FREE_METERS;
  return Math.min(MOVE_DISTANCE_MAX_PENALTY, excess * MOVE_DISTANCE_PENALTY_PER_METER);
}

function deriveVerdict(moveScore: number, pulseScore: number, trend: TrendDirection, waitEstimate: WaitEstimate | null): MoveVerdict {
  if (waitEstimate && waitEstimate.minMinutes >= MOVE_HIGH_LINE_RISK_MINUTES) return "HIGH_LINE_RISK";
  // Checked before NOT_WORTH_TRIP — "building but not there yet" is a distinct, more
  // hopeful read than "nothing redeeming here," even though both can share a low raw score.
  if (pulseScore < MOVE_TOO_EARLY_MAX_PULSE_SCORE && (trend === "RISING" || trend === "RISING_FAST")) return "TOO_EARLY";
  if (moveScore < MOVE_NOT_WORTH_TRIP_MAX_SCORE) return "NOT_WORTH_TRIP";
  if ((trend === "FALLING" || trend === "FALLING_FAST") && pulseScore >= MOVE_COOLING_MIN_PULSE_SCORE) return "COOLING";
  if (moveScore >= MOVE_PEAKING_MIN_SCORE) return "PEAKING";
  return "GOOD_MOVE";
}

/**
 * "Should we go there" — distinct from pulseScore's "what's happening there." Never
 * computed for a CLOSED venue (there's no "should we go" question for a place that isn't
 * open); every other coverage state gets a score, since a DIRECTORY venue's baseline-only
 * reading is exactly what's already shown elsewhere (the Typical line, the open/closed
 * marker color) — this just folds the same honest signal into one number instead of
 * fabricating anything new. Low confidence dampens the score toward neutral (50) rather
 * than gating it off entirely, so a thin-data venue can't swing to a false extreme in
 * either direction.
 */
export function calculateMoveScore(input: MoveScoreInput): MoveResult | null {
  if (input.currentPulseStatus === "CLOSED") return null;

  let score = input.pulseScore;
  score += MOVE_TREND_ADJUSTMENT[input.trend];
  score -= waitPenalty(input.waitEstimate);
  score -= distancePenalty(input.distanceMeters);

  const confidenceFactor = Math.max(0, Math.min(1, input.confidenceScore / 100));
  const pullStrength = 0.5 + 0.5 * confidenceFactor; // 0.5 at zero confidence, 1.0 at full confidence
  score = 50 + (score - 50) * pullStrength;
  score = Math.round(Math.max(0, Math.min(100, score)));

  return { moveScore: score, verdict: deriveVerdict(score, input.pulseScore, input.trend, input.waitEstimate) };
}
