import type { ConfidenceLabel, VenueHourlyBaseline } from "@/types";
import { zonedParts } from "@/lib/time/zoned";

const LOOKAHEAD_HOURS = 6;

/**
 * Scans the next few hours of baseline activity to guess when this venue peaks.
 * Returns a time *range*, widened when confidence is low, rather than a fake precise
 * minute — and returns null if the peak has already passed (nothing forward to say).
 */
export function estimateExpectedPeak(
  baselines: VenueHourlyBaseline[],
  now: Date,
  timeZone: string,
  confidenceLabel: ConfidenceLabel
): { start: string; end: string } | null {
  let bestOffsetHours = -1;
  let bestScore = -1;
  let currentScore = -1;

  for (let offset = 0; offset <= LOOKAHEAD_HOURS; offset++) {
    const t = new Date(now.getTime() + offset * 3_600_000);
    const { hour, dayOfWeek } = zonedParts(t, timeZone);
    const row = baselines.find((b) => b.dayOfWeek === dayOfWeek && b.hourOfDay === hour);
    const score = row?.expectedActivityScore ?? -1;
    if (offset === 0) currentScore = score;
    if (score > bestScore) {
      bestScore = score;
      bestOffsetHours = offset;
    }
  }

  if (bestScore < 0 || bestOffsetHours <= 0 || bestScore <= currentScore + 5) {
    return null;
  }

  const peakTime = new Date(now.getTime() + bestOffsetHours * 3_600_000);
  const rangeWidthHours = confidenceLabel === "LOW" ? 1.5 : confidenceLabel === "MEDIUM" ? 1 : 0.5;

  return {
    start: new Date(peakTime.getTime() - (rangeWidthHours * 3_600_000) / 2).toISOString(),
    end: new Date(peakTime.getTime() + (rangeWidthHours * 3_600_000) / 2).toISOString(),
  };
}
