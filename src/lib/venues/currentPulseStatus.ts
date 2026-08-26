import type { CurrentPulseStatus, VenueOpenState } from "@/types";

/** Thin derivation of the already-authoritative openState — not a second independent
 * closed/open computation. A venue reads LIVE only while genuinely OPEN/CLOSING_SOON;
 * everything else (CLOSED, TEMPORARILY/PERMANENTLY_CLOSED, UNKNOWN) must not show a
 * live-looking score, regardless of what the raw pulseScore number happens to be. */
export function currentPulseStatusFor(openState: VenueOpenState): CurrentPulseStatus {
  return openState === "OPEN" || openState === "CLOSING_SOON" ? "LIVE" : "CLOSED";
}
