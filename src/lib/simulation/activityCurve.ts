import type { VenueType } from "@/types";
import { mulberry32 } from "@/lib/geo";

// Hand-tuned hour-of-day curves (0-100) per venue type. Index = hour (0-23).
// These aren't measured data — they're the category-typical shape used to seed
// baselines and drive the demo simulator so both stay consistent with each other.
const BASE_CURVES: Record<VenueType, number[]> = {
  CLUB: [
    2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 8, 18, 32, 55, 78, 92,
  ],
  BAR: [
    35, 20, 8, 2, 0, 0, 0, 0, 0, 5, 10, 18, 32, 38, 42, 48, 55, 62, 70, 78, 82, 80, 68, 52,
  ],
  LOUNGE: [
    30, 18, 6, 1, 0, 0, 0, 0, 0, 0, 5, 12, 22, 28, 32, 38, 46, 55, 65, 75, 80, 78, 66, 48,
  ],
  ROOFTOP: [
    10, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 20, 34, 42, 50, 58, 68, 75, 72, 60, 45, 30, 18, 12,
  ],
  RESTAURANT: [
    0, 0, 0, 0, 0, 0, 0, 5, 15, 25, 35, 48, 62, 58, 40, 28, 30, 45, 68, 82, 75, 55, 20, 5,
  ],
  LIVE_MUSIC: [
    5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 8, 12, 15, 20, 28, 38, 48, 52, 50, 40, 20,
  ],
  CAFE: [
    0, 0, 0, 0, 0, 0, 10, 35, 62, 68, 55, 48, 52, 45, 38, 32, 25, 15, 5, 0, 0, 0, 0, 0,
  ],
  EVENT_SPACE: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 15, 18, 20, 22, 25, 28, 30, 32, 30, 25, 15, 5,
  ],
  OTHER: [
    15, 10, 5, 2, 0, 0, 5, 10, 20, 28, 32, 35, 38, 38, 35, 32, 30, 32, 35, 38, 36, 32, 25, 18,
  ],
};

// Sun=0 ... Sat=6
const DAY_MULTIPLIER = [0.85, 0.65, 0.68, 0.72, 0.85, 1.35, 1.5];

export function baseActivityForHour(venueType: VenueType, dayOfWeek: number, hour: number): number {
  const curve = BASE_CURVES[venueType];
  const dayMult = DAY_MULTIPLIER[dayOfWeek] ?? 1;
  return Math.min(100, Math.max(0, curve[hour] * dayMult));
}

/** Small, deterministic per-venue personality so every club doesn't look identical. */
export function venueVariance(venueSeed: number, dayOfWeek: number, hour: number): number {
  const rand = mulberry32(venueSeed * 10_000 + dayOfWeek * 100 + hour);
  return (rand() - 0.5) * 12;
}

export function expectedActivityScore(
  venueType: VenueType,
  venueSeed: number,
  dayOfWeek: number,
  hour: number
): number {
  const base = baseActivityForHour(venueType, dayOfWeek, hour);
  const variance = venueVariance(venueSeed, dayOfWeek, hour);
  return Math.min(100, Math.max(0, Math.round(base + variance)));
}

/** Wait tends to track activity but lags/compresses at the extremes — busy rooms have lines, dead rooms never do. */
export function expectedWaitScore(activityScore: number): number {
  if (activityScore < 40) return 0;
  return Math.min(100, Math.round((activityScore - 40) * 1.4));
}
