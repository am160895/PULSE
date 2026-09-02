import type { VenueWithPulse } from "@/types";

export type MapMarkerClass = "closed" | "hot" | "irish" | "open";

/**
 * The map marker's color language is deliberately coarser than the 5-level busy-ness ramp
 * used elsewhere (PulseLabelBadge/PulseScoreDisplay, see markerClassForLabel in Badges.tsx)
 * — a glance at the map should answer one question (open, closed, slammed, or an Irish
 * pub), not distinguish moderate from busy.
 *
 * Open/closed comes from real, always-known hours data. "Really busy" runs off
 * pulseLabel directly, which already blends live reports with historical-baseline
 * popularity (weighted toward whichever is more trustworthy right now — see
 * calculatePulseScore) — nearly every real venue starts with zero live reports
 * (DIRECTORY coverage), and this is what lets the map read as alive off typical patterns
 * from day one instead of looking dead until reports accumulate. Freshness/live-vs-typical
 * honesty is a text-level concern (FreshnessBadge, "No live pulse yet") — the color itself
 * doesn't need to gate on it. Irish is a static category tag, shown only once neither
 * closed nor really-busy applies.
 */
export function mapMarkerClass(venue: VenueWithPulse): MapMarkerClass {
  if (venue.currentPulseStatus === "CLOSED") return "closed";
  if (venue.pulse.pulseLabel === "HOT_NOW") return "hot";
  if (venue.subcategory === "IRISH") return "irish";
  return "open";
}
