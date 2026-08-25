import type { VenueHours } from "@/types";
import { findOpenWindow } from "@/lib/venues/hours";

export interface OpennessSignalOutput {
  isOpenNow: boolean;
  opennessFactor: number; // 0-1 multiplier applied to the rest of the blended score
  minutesSinceOpen: number | null;
  minutesUntilClose: number | null;
}

const RAMP_MINUTES = 30;

/**
 * A closed venue must read near-zero regardless of how strong its historical/event
 * signals are — so openness is applied as a multiplicative gate on the final blend,
 * not averaged in as just another 0-100 component (a naive weighted average would let
 * a Wednesday-2am closed bar still show ~60 on the strength of its Friday baseline).
 */
export function calculateOpennessSignal(
  hours: VenueHours[],
  now: Date,
  timeZone: string
): OpennessSignalOutput {
  if (hours.length === 0) {
    // No hours on file — for *scoring* purposes, don't penalize; better to show a score
    // than hide the venue. (The UI-facing open state treats this same case as UNKNOWN
    // instead — see src/lib/venues/openState.ts — a different, legitimate default for a
    // different consumer, not a second copy of the window-matching logic itself.)
    return { isOpenNow: true, opennessFactor: 1, minutesSinceOpen: null, minutesUntilClose: null };
  }

  const window = findOpenWindow(hours, now, timeZone);
  if (!window.isOpenNow) {
    return { isOpenNow: false, opennessFactor: 0, minutesSinceOpen: null, minutesUntilClose: null };
  }

  return {
    isOpenNow: true,
    opennessFactor: rampFactor(window.minutesSinceOpen!, window.minutesUntilClose!),
    minutesSinceOpen: window.minutesSinceOpen,
    minutesUntilClose: window.minutesUntilClose,
  };
}

function rampFactor(minutesSinceOpen: number, minutesUntilClose: number): number {
  const openRamp = Math.min(1, minutesSinceOpen / RAMP_MINUTES);
  const closeRamp = Math.min(1, minutesUntilClose / RAMP_MINUTES);
  return Math.max(0, Math.min(1, Math.min(openRamp, closeRamp)));
}
