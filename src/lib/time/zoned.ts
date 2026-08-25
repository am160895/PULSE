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
