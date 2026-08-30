import type { VenueWithPulse } from "@/types";

export type MapMarkerClass = "closed" | "hot" | "irish" | "open";

/**
 * The map marker's color language is deliberately coarser than the 5-level busy-ness ramp
 * used elsewhere (PulseLabelBadge/PulseScoreDisplay, see markerClassForLabel in Badges.tsx)
 * — a glance at the map should answer one question (open, closed, slammed, or an Irish
 * pub), not distinguish moderate from busy.
 *
 * Open/closed comes from real, always-known hours data, so every venue earns an honest
 * green or grey regardless of whether it has any live PULSE activity — nearly every real
 * venue starts with zero reports (DIRECTORY coverage), and grey-ing all of those out too
 * would leave the whole map looking dead again. "Really busy" is different: it must never
 * come from a DIRECTORY venue's pure baseline projection, which would dress up a guess as
 * a confirmed live crowd — only a genuine LIVE/RECENT signal can turn a marker red. Irish
 * is a static category tag, shown only once neither closed nor really-busy applies.
 */
export function mapMarkerClass(venue: VenueWithPulse): MapMarkerClass {
  if (venue.currentPulseStatus === "CLOSED") return "closed";
  const hasLiveSignal = venue.coverageState === "LIVE" || venue.coverageState === "RECENT";
  if (hasLiveSignal && venue.pulse.pulseLabel === "HOT_NOW") return "hot";
  if (venue.subcategory === "IRISH") return "irish";
  return "open";
}
