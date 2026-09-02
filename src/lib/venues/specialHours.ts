import type { VenueHours, VenueSpecialHours } from "@/types";
import { previousCalendarDate, zonedDateParts, type ZonedDateParts } from "@/lib/time/zoned";

type DateParts = Pick<ZonedDateParts, "year" | "month" | "day" | "dayOfWeek">;

function toIsoDate(parts: Pick<DateParts, "year" | "month" | "day">): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function specialHoursRowToVenueHours(dayOfWeek: number, special: VenueSpecialHours): VenueHours {
  return {
    id: special.id,
    venueId: special.venueId,
    dayOfWeek,
    isClosed: special.isClosed,
    openTime: special.openTime,
    closeTime: special.closeTime,
    source: special.source,
    lastVerifiedAt: special.lastVerifiedAt,
  };
}

/** The regular-hours rows for one venue-local calendar date, with a special-hours
 * override applied if one exists for that exact date — used by getVenueOpenStatus's
 * forward scan for nextOpenAt, which needs to resolve arbitrary future dates one at a
 * time (not just "today"/"yesterday", which is all buildEffectiveHours below covers). */
export function effectiveHoursForDate(hours: VenueHours[], specialHours: VenueSpecialHours[], date: DateParts): VenueHours[] {
  const iso = toIsoDate(date);
  const special = specialHours.find((s) => s.specialDate === iso);
  if (!special) return hours.filter((h) => h.dayOfWeek === date.dayOfWeek);
  // Always return a row (isClosed:true when the override is a closure) rather than an
  // empty array — an empty hours array elsewhere means "no hours info at all" (UNKNOWN),
  // which is a different, wrong meaning from "we know this specific day is closed."
  return [specialHoursRowToVenueHours(date.dayOfWeek, special)];
}

/**
 * Overlays special-hours overrides onto the regular weekly schedule for exactly the two
 * venue-local calendar dates findOpenWindow ever examines (today and yesterday, per its
 * own overnight-crossing logic) — a special-hours row for one of those dates replaces
 * that date's regular hours rows entirely with one synthetic row (isClosed:true for a
 * closure, or the special open/close times otherwise), matching "special wins entirely."
 * Always a replacement row, never just a removal: an empty hours array means "no hours
 * info at all" (UNKNOWN) elsewhere in this codebase, which is a different, wrong meaning
 * from "we know this specific day is closed" (CLOSED). Days outside {today, yesterday}
 * pass through unmodified, since findOpenWindow never looks at them anyway.
 */
export function buildEffectiveHours(hours: VenueHours[], specialHours: VenueSpecialHours[], now: Date, timeZone: string): VenueHours[] {
  if (specialHours.length === 0) return hours;

  const today = zonedDateParts(now, timeZone);
  // Pure calendar-date rollback, not "subtract 24 real hours" — the latter can land on the
  // wrong calendar date within about an hour of midnight on the day after a DST
  // transition, since that day is only 23 (or 25) real hours long.
  const yesterday = { ...previousCalendarDate(today), dayOfWeek: (today.dayOfWeek + 6) % 7 };

  const todaySpecial = specialHours.find((s) => s.specialDate === toIsoDate(today));
  const yesterdaySpecial = specialHours.find((s) => s.specialDate === toIsoDate(yesterday));
  if (!todaySpecial && !yesterdaySpecial) return hours;

  let effective = hours;
  if (todaySpecial) {
    effective = [...effective.filter((h) => h.dayOfWeek !== today.dayOfWeek), specialHoursRowToVenueHours(today.dayOfWeek, todaySpecial)];
  }
  if (yesterdaySpecial) {
    effective = [
      ...effective.filter((h) => h.dayOfWeek !== yesterday.dayOfWeek),
      specialHoursRowToVenueHours(yesterday.dayOfWeek, yesterdaySpecial),
    ];
  }
  return effective;
}
