import type { VenueWithPulse } from "@/types";

export interface ExploreSection {
  key: string;
  title: string;
  venues: VenueWithPulse[];
}

const SECTION_SIZE = 8;

/**
 * All rule-based, from the same data every other page uses — no separate
 * "trending" model. Each section is a different lens on the same pulse scores.
 */
export function buildExploreSections(venues: VenueWithPulse[]): ExploreSection[] {
  const open = venues.filter((v) => v.pulse.pulseScore > 0);

  const hotNow = [...open].filter((v) => v.pulse.pulseLabel === "HOT_NOW").sort(byScoreDesc);

  const risingFastest = [...open]
    .filter((v) => v.pulse.trend === "RISING_FAST" || v.pulse.trend === "RISING")
    .sort((a, b) => b.pulse.trendDeltaLast30Min - a.pulse.trendDeltaLast30Min);

  const nearYou = venues[0]?.distanceMeters !== undefined
    ? [...open].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    : [];

  const friendsAreHere = [...open].filter((v) => (v.friendsPresent?.length ?? 0) > 0).sort(byScoreDesc);

  const worthTheTrip = [...open]
    .filter((v) => v.pulse.pulseScore >= 75 && (v.pulse.trend === "RISING" || v.pulse.trend === "RISING_FAST"))
    .sort(byScoreDesc);

  const quietButGood = [...open]
    .filter(
      (v) =>
        v.pulse.pulseScore >= 40 &&
        v.pulse.pulseScore <= 72 &&
        v.pulse.confidenceLabel !== "LOW" &&
        (v.pulse.waitEstimate === null || (v.pulse.waitEstimate.maxMinutes ?? 99) <= 15)
    )
    .sort(byScoreDesc);

  const noLinePicks = [...open]
    .filter((v) => v.pulse.waitEstimate === null || (v.pulse.waitEstimate.maxMinutes ?? 99) <= 5)
    .sort(byScoreDesc);

  const lateNight = [...open]
    .filter((v) => ["CLUB", "LOUNGE", "BAR"].includes(v.venueType))
    .sort(byScoreDesc);

  const sections: ExploreSection[] = [
    { key: "hotNow", title: "Hot now", venues: hotNow },
    { key: "risingFastest", title: "Rising fastest", venues: risingFastest },
    ...(nearYou.length ? [{ key: "nearYou", title: "Near you", venues: nearYou }] : []),
    { key: "friendsAreHere", title: "Friends are here", venues: friendsAreHere },
    { key: "worthTheTrip", title: "Worth the trip", venues: worthTheTrip },
    { key: "quietButGood", title: "Quiet but good", venues: quietButGood },
    { key: "noLinePicks", title: "No-line picks", venues: noLinePicks },
    { key: "lateNight", title: "Late-night", venues: lateNight },
  ];

  return sections
    .map((s) => ({ ...s, venues: s.venues.slice(0, SECTION_SIZE) }))
    .filter((s) => s.venues.length > 0);
}

function byScoreDesc(a: VenueWithPulse, b: VenueWithPulse) {
  return b.pulse.pulseScore - a.pulse.pulseScore;
}
