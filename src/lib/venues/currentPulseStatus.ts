import type { CurrentPulseStatus, VenueOpenState } from "@/types";

/** Thin derivation of the already-authoritative openState — not a second independent
 * closed/open computation. CLOSED only for states we're actually CONFIDENT the venue is
 * closed (CLOSED, TEMPORARILY/PERMANENTLY_CLOSED) — never for UNKNOWN. Absence of hours
 * data is not evidence of being closed, and calculatePulseScore.ts's openness gate
 * already deliberately treats an empty hours array as "assume open, don't penalize" (see
 * its own comment) — this must agree with that, or a venue with real reports but no
 * hours on file would compute a normal live score yet have it hidden behind a false
 * "closed" display, which is worse than showing nothing. */
export function currentPulseStatusFor(openState: VenueOpenState): CurrentPulseStatus {
  const confidentlyClosed: VenueOpenState[] = ["CLOSED", "TEMPORARILY_CLOSED", "PERMANENTLY_CLOSED"];
  return confidentlyClosed.includes(openState) ? "CLOSED" : "LIVE";
}
