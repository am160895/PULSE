const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface ZonedParts {
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 = Sunday
}

/**
 * Reads the wall-clock hour/minute/day-of-week for `date` in `timeZone`.
 * Needed because hourly baselines and "is it open" checks are meaningless in server
 * local time once this deploys somewhere that isn't the venue's own timezone (e.g.
 * Vercel functions default to UTC).
 */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  return {
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    dayOfWeek: WEEKDAY_INDEX[map.weekday] ?? date.getDay(),
  };
}

export interface ZonedDateParts extends ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Same as zonedParts, plus the calendar date — needed for special-hours lookups (a
 * "special_date" override is keyed by venue-local calendar date, not just time-of-day). */
export function zonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    dayOfWeek: WEEKDAY_INDEX[map.weekday] ?? date.getDay(),
  };
}

/**
 * Inverse of zonedDateParts: given a wall-clock date/time as it should read *in
 * `timeZone`*, returns the UTC instant it corresponds to. No `date-fns-tz`/`luxon` is
 * installed — this uses the same Intl.DateTimeFormat technique zonedParts relies on, run
 * in reverse with one correction pass (accurate to the minute outside the DST-transition
 * hour itself, which doesn't matter for nightlife open/close times).
 */
export function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const guessAsZoned = zonedDateParts(guess, timeZone);
  const guessInterpretedAsUtc = Date.UTC(
    guessAsZoned.year,
    guessAsZoned.month - 1,
    guessAsZoned.day,
    guessAsZoned.hour,
    guessAsZoned.minute
  );
  return new Date(guess.getTime() + (guess.getTime() - guessInterpretedAsUtc));
}

export function formatDate(parts: Pick<ZonedDateParts, "year" | "month" | "day">): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Pure calendar-date rollback on already-extracted local y/m/d — no timezone/DST
 * involvement at all (Date.UTC here just borrows month/year-rollover arithmetic, it is
 * never treated as a real timezone conversion). */
export function previousCalendarDate(parts: Pick<ZonedDateParts, "year" | "month" | "day">): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export interface NightlifeDateParts extends ZonedDateParts {
  /** Venue-LOCAL calendar date ("YYYY-MM-DD") the "night out" containing this instant
   * belongs to — e.g. 2:00 AM Saturday is still part of Friday night. */
  nightlifeDate: string;
  /** Day-of-week (0=Sunday) OF nightlifeDate — not of the actual wall-clock day above. */
  nightlifeDayOfWeek: number;
}

/**
 * Classifies an instant into the nightlife-specific "night out" it belongs to, using a
 * configurable local boundary hour (default 6 AM — nightlife runs later than the
 * calendar day does). Only used by the historical-rollup subsystem (see
 * lib/pulse/history/nightlyRollup.ts) — deliberately NOT used by hours/open-status
 * logic, where a venue's Tuesday hours row genuinely means calendar Tuesday, or by the
 * existing venue_hourly_baselines read path, which is keyed by calendar day and has no
 * matching nightlife-day write path to reconcile against.
 */
export function nightlifeDayParts(date: Date, timeZone: string, boundaryHour = 6): NightlifeDateParts {
  const zoned = zonedDateParts(date, timeZone);
  if (zoned.hour >= boundaryHour) {
    return { ...zoned, nightlifeDate: formatDate(zoned), nightlifeDayOfWeek: zoned.dayOfWeek };
  }
  const prev = previousCalendarDate(zoned);
  return { ...zoned, nightlifeDate: formatDate(prev), nightlifeDayOfWeek: (zoned.dayOfWeek + 6) % 7 };
}
