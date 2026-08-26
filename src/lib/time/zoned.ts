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
