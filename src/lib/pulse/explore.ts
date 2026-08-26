import type { VenueWithPulse } from "@/types";
import { BEST_BET_MAX_DISTANCE_METERS, BEST_BET_MIN_MINUTES_UNTIL_CLOSE, BEST_BET_MIN_SCORE } from "@/config/constants";

export interface ExploreSection {
  key: string;
  title: string;
  venues: VenueWithPulse[];
}

const SECTION_SIZE = 8;

/** Exported (not inlined into buildExploreSections) so the map's Best Bet filter chip
 * calls this exact predicate — one definition, no risk of the map and Explore silently
 * drifting apart on what counts as a good bet. */
export function isBestBetVenue(v: VenueWithPulse, now: Date): boolean {
  if (v.pulse.pulseScore < BEST_BET_MIN_SCORE) return false;
  if (v.pulse.confidenceLabel === "LOW") return false;
  if (v.pulse.trend === "FALLING_FAST") return false;
  if (v.distanceMeters !== undefined && v.distanceMeters > BEST_BET_MAX_DISTANCE_METERS) return false;
  if (v.openStatus.closesAt) {
    const minutesUntilClose = (new Date(v.openStatus.closesAt).getTime() - now.getTime()) / 60_000;
    if (minutesUntilClose < BEST_BET_MIN_MINUTES_UNTIL_CLOSE) return false;
  }
  return true;
}

function bestBetRank(v: VenueWithPulse): number {
  let score = v.pulse.pulseScore;
  if (v.pulse.confidenceLabel === "HIGH") score += 10;
  if (v.pulse.trend === "FALLING") score -= 8;
  if (v.pulse.trend === "RISING" || v.pulse.trend === "RISING_FAST") score += 5;
  return score;
}

/**
 * All rule-based, from the same data every other page uses — no separate
 * "trending" model. Each section is a different lens on the same pulse scores.
 */
export function buildExploreSections(venues: VenueWithPulse[], now: Date): ExploreSection[] {
  const open = venues.filter((v) => v.pulse.pulseScore > 0);

  const hotNow = [...open].filter((v) => v.pulse.pulseLabel === "HOT_NOW").sort(byScoreDesc);

  const risingFastest = [...open]
    .filter((v) => v.pulse.trend === "RISING_FAST" || v.pulse.trend === "RISING")
    .sort((a, b) => b.pulse.trendDeltaLast30Min - a.pulse.trendDeltaLast30Min);

  const bestBet = [...open].filter((v) => isBestBetVenue(v, now)).sort((a, b) => bestBetRank(b) - bestBetRank(a));

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
    { key: "bestBet", title: "Best bet", venues: bestBet },
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
