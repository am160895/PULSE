import type { VenueHourlyBaseline } from "@/types";
import { zonedParts } from "@/lib/time/zoned";

export interface HistoricalSignalOutput {
  historicalScore: number;
  historicalWaitScore: number;
  sampleCount: number;
}

const FALLBACK_SCORE = 30; // no baseline row at all (shouldn't happen once seeded, but stay honest)

/**
 * Looks up the expected activity for this exact day-of-week + hour (in the venue's own
 * timezone, not server local time), falling back to a linear blend with the neighboring
 * hour so a venue doesn't show a cliff at :00.
 */
export function calculateHistoricalSignal(
  baselines: VenueHourlyBaseline[],
  now: Date,
  timeZone: string
): HistoricalSignalOutput {
  const { hour, minute, dayOfWeek } = zonedParts(now, timeZone);
  const minuteFraction = minute / 60;

  const current = baselines.find((b) => b.dayOfWeek === dayOfWeek && b.hourOfDay === hour);
  const nextHour = (hour + 1) % 24;
  const nextDay = nextHour === 0 ? (dayOfWeek + 1) % 7 : dayOfWeek;
  const next = baselines.find((b) => b.dayOfWeek === nextDay && b.hourOfDay === nextHour);

  if (!current && !next) {
    return { historicalScore: FALLBACK_SCORE, historicalWaitScore: 0, sampleCount: 0 };
  }
  if (!next || !current) {
    const only = current ?? next!;
    return {
      historicalScore: only.expectedActivityScore,
      historicalWaitScore: only.expectedWaitScore,
      sampleCount: only.sampleCount,
    };
  }

  const historicalScore =
    current.expectedActivityScore * (1 - minuteFraction) + next.expectedActivityScore * minuteFraction;
  const historicalWaitScore =
    current.expectedWaitScore * (1 - minuteFraction) + next.expectedWaitScore * minuteFraction;

  return {
    historicalScore,
    historicalWaitScore,
    sampleCount: Math.min(current.sampleCount, next.sampleCount),
  };
}
