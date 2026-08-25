import type { TrendDirection, VenueSignalSnapshot } from "@/types";
import { TREND_THRESHOLDS, TREND_WINDOW_MINUTES } from "@/config/constants";

export interface TrendSignalOutput {
  trendDirection: TrendDirection;
  deltaLast30Min: number;
  trendComponentScore: number; // 0-100, 50 = neutral/stable, feeds into the weighted blend
}

/**
 * Derives momentum from the venue's own score history (not raw reports directly) so
 * this can't double-count the same evidence the live-report signal already used.
 */
export function calculateTrendSignal(
  history: VenueSignalSnapshot[],
  now: Date
): TrendSignalOutput {
  if (history.length === 0) {
    return { trendDirection: "STABLE", deltaLast30Min: 0, trendComponentScore: 50 };
  }

  const cutoff = now.getTime() - TREND_WINDOW_MINUTES * 60_000;
  // Bounded on both ends: a snapshot older than 2x the window means there's a gap in
  // history (venue reopened after hours closed, nobody viewed the page in a while, etc.)
  // — comparing "now" against a stale point and calling the result "the last 30 minutes"
  // would fabricate momentum that never happened, exactly the kind of false precision
  // this product is supposed to avoid.
  const maxAge = now.getTime() - TREND_WINDOW_MINUTES * 2 * 60_000;
  const past = [...history]
    .filter((s) => {
      const t = new Date(s.capturedAt).getTime();
      return t <= cutoff && t >= maxAge;
    })
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

  const mostRecent = [...history].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  )[0];

  if (!past) {
    return { trendDirection: "STABLE", deltaLast30Min: 0, trendComponentScore: 50 };
  }

  const delta = mostRecent.pulseScore - past.pulseScore;

  let trendDirection: TrendDirection = "STABLE";
  if (delta >= TREND_THRESHOLDS.risingFast) trendDirection = "RISING_FAST";
  else if (delta >= TREND_THRESHOLDS.rising) trendDirection = "RISING";
  else if (delta <= TREND_THRESHOLDS.fallingFast) trendDirection = "FALLING_FAST";
  else if (delta <= TREND_THRESHOLDS.falling) trendDirection = "FALLING";

  const trendComponentScore = Math.min(100, Math.max(0, 50 + delta * 1.5));

  return { trendDirection, deltaLast30Min: delta, trendComponentScore };
}
