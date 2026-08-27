import type { VenueType } from "@/types";
import type { NewVenueHoursInput } from "@/lib/data/repository";

// Typical open/close windows per venue type — originally scripts/seed.ts's own synthetic
// curve (now imported from here instead of duplicated), reused as the estimate applied to
// real imported venues that have no hours on file yet. Always written with source: "SEED",
// the same tag the app already uses everywhere to mean "not personally verified" — this is
// not a new kind of claim, just the app's existing honesty signal (LOW hoursConfidence,
// "Hours may vary") applied consistently instead of showing nothing at all.
// [dayOfWeek, openTime, closeTime][] — dayOfWeek 0=Sun
const HOURS_BY_TYPE: Record<VenueType, [number, string, string][]> = {
  CLUB: [[3, "22:00", "02:00"], [4, "22:00", "03:00"], [5, "22:00", "04:00"], [6, "22:00", "04:00"]],
  BAR: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "16:00", d === 5 || d === 6 ? "03:00" : "02:00"]) as [number, string, string][],
  LOUNGE: [2, 3, 4, 5, 6].map((d) => [d, "18:00", "02:00"]) as [number, string, string][],
  ROOFTOP: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "16:00", d === 5 || d === 6 ? "01:00" : "00:00"]) as [number, string, string][],
  RESTAURANT: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "11:30", "23:00"]) as [number, string, string][],
  LIVE_MUSIC: [4, 5, 6, 0].map((d) => [d, "19:00", "01:00"]) as [number, string, string][],
  CAFE: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "07:00", "19:00"]) as [number, string, string][],
  EVENT_SPACE: [5, 6].map((d) => [d, "19:00", "01:00"]) as [number, string, string][],
  OTHER: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "12:00", "22:00"]) as [number, string, string][],
};

export function buildTypicalHours(venueType: VenueType): NewVenueHoursInput[] {
  return HOURS_BY_TYPE[venueType].map(([dayOfWeek, openTime, closeTime]) => ({
    dayOfWeek,
    isClosed: false,
    openTime,
    closeTime,
    source: "SEED",
    lastVerifiedAt: null,
  }));
}
