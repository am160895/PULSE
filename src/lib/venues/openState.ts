import type { BusinessStatus, VenueHours, VenueOpenState } from "@/types";
import { findOpenWindow } from "./hours";

const CLOSING_SOON_THRESHOLD_MINUTES = 30;

/**
 * The one function that answers "is this venue open" for anything UI-facing — a
 * deliberately richer answer than the scoring engine's 0-1 openness gate
 * (pulse/signals/timeDecay.ts), which only needs a number. A venue can never show HOT_NOW
 * if this returns CLOSED/TEMPORARILY_CLOSED/PERMANENTLY_CLOSED, regardless of how strong
 * its historical baseline is — enforced in lib/pulse/composeVenue.ts.
 */
export function deriveVenueOpenState(
  hours: VenueHours[],
  now: Date,
  timeZone: string,
  businessStatus?: BusinessStatus | null
): VenueOpenState {
  if (businessStatus === "CLOSED_PERMANENTLY") return "PERMANENTLY_CLOSED";
  if (businessStatus === "CLOSED_TEMPORARILY") return "TEMPORARILY_CLOSED";
  if (hours.length === 0) return "UNKNOWN";

  const window = findOpenWindow(hours, now, timeZone);
  if (!window.isOpenNow) return "CLOSED";
  if (window.minutesUntilClose !== null && window.minutesUntilClose <= CLOSING_SOON_THRESHOLD_MINUTES) {
    return "CLOSING_SOON";
  }
  return "OPEN";
}

export const VENUE_OPEN_STATE_TEXT: Record<VenueOpenState, string> = {
  OPEN: "Open",
  CLOSING_SOON: "Closing soon",
  CLOSED: "Closed",
  TEMPORARILY_CLOSED: "Temporarily closed",
  PERMANENTLY_CLOSED: "Permanently closed",
  UNKNOWN: "Hours unknown",
};
