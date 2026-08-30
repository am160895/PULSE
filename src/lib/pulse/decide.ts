import type { VenueWithPulse } from "@/types";
import { DECIDE_ENERGY_ALT_MIN_SCORE_DELTA, DECIDE_MAX_CANDIDATES, DECIDE_WAIT_ALT_MIN_MINUTES_SAVED } from "@/config/constants";

export interface DecideResult {
  bestMove: VenueWithPulse | null;
  /** Only set when a real candidate is meaningfully higher-energy than bestMove. */
  moreEnergy: VenueWithPulse | null;
  /** Only set when a real candidate meaningfully beats bestMove's wait. */
  lessWait: VenueWithPulse | null;
}

function waitMinutes(v: VenueWithPulse): number {
  return v.pulse.waitEstimate?.minMinutes ?? 0;
}

/**
 * The "Decider" layer, distinct from the map/Explore's "here's everything" — one answer
 * to "where should we go," not a scrollable list. Never considers a CLOSED venue (move is
 * null there) or one Move Score itself couldn't score. moreEnergy/lessWait are optional —
 * they only appear when a genuinely different, meaningfully-better-on-that-axis option
 * exists among the next-best candidates, never forced to fill a slot.
 */
export function pickDecision(venues: VenueWithPulse[]): DecideResult {
  const candidates = venues
    .filter((v): v is VenueWithPulse & { move: NonNullable<VenueWithPulse["move"]> } => v.move !== null)
    .sort((a, b) => b.move.moveScore - a.move.moveScore);

  const bestMove = candidates[0] ?? null;
  if (!bestMove) return { bestMove: null, moreEnergy: null, lessWait: null };

  const rest = candidates.slice(1, DECIDE_MAX_CANDIDATES);

  const moreEnergy =
    [...rest]
      .filter((v) => v.pulse.pulseScore >= bestMove.pulse.pulseScore + DECIDE_ENERGY_ALT_MIN_SCORE_DELTA)
      .sort((a, b) => b.pulse.pulseScore - a.pulse.pulseScore)[0] ?? null;

  const bestMoveWait = waitMinutes(bestMove);
  const lessWait =
    [...rest]
      .filter((v) => bestMoveWait - waitMinutes(v) >= DECIDE_WAIT_ALT_MIN_MINUTES_SAVED)
      .sort((a, b) => waitMinutes(a) - waitMinutes(b))[0] ?? null;

  return { bestMove, moreEnergy, lessWait };
}
