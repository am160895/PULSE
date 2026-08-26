import type { BusinessStatus, ConfidenceLabel, HoursSource, VenueHours, VenueOpenStatus, VenueSpecialHours } from "@/types";
import { HOURS_VERIFIED_FRESH_DAYS, HOURS_VERIFIED_STALE_DAYS } from "@/config/constants";
import { findOpenWindow } from "./hours";
import { deriveVenueOpenState } from "./openState";
import { buildEffectiveHours, effectiveHoursForDate } from "./specialHours";
import { zonedDateParts, zonedDateToUtc } from "@/lib/time/zoned";

const NEXT_OPEN_SCAN_DAYS = 8;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatVenueLocalTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function hoursConfidenceForRow(source: HoursSource, lastVerifiedAt: string | null, now: Date): ConfidenceLabel {
  if (!lastVerifiedAt) return source === "SEED" ? "LOW" : "MEDIUM";
  const ageDays = (now.getTime() - new Date(lastVerifiedAt).getTime()) / 86_400_000;
  if ((source === "ADMIN" || source === "VENUE_OWNER") && ageDays <= HOURS_VERIFIED_FRESH_DAYS) return "HIGH";
  if (ageDays <= HOURS_VERIFIED_STALE_DAYS) return "MEDIUM";
  return "LOW";
}

/** Confidence is only as strong as the least-verified row that actually fed today's
 * open/closed determination — a fresh Friday entry doesn't make a stale Tuesday one trustworthy. */
function hoursConfidenceForRows(rows: VenueHours[], now: Date): ConfidenceLabel {
  if (rows.length === 0) return "LOW";
  const labels = rows.map((r) => hoursConfidenceForRow(r.source, r.lastVerifiedAt, now));
  if (labels.includes("LOW")) return "LOW";
  if (labels.includes("MEDIUM")) return "MEDIUM";
  return "HIGH";
}

function findNextOpenInstant(hours: VenueHours[], specialHours: VenueSpecialHours[], now: Date, timeZone: string): Date | null {
  for (let dayOffset = 0; dayOffset < NEXT_OPEN_SCAN_DAYS; dayOffset++) {
    const candidate = zonedDateParts(new Date(now.getTime() + dayOffset * 24 * 3_600_000), timeZone);
    const dayHours = effectiveHoursForDate(hours, specialHours, candidate);
    for (const h of dayHours) {
      if (h.isClosed || !h.openTime) continue;
      const openMinutes = toMinutes(h.openTime);
      const openInstant = zonedDateToUtc(
        candidate.year,
        candidate.month,
        candidate.day,
        Math.floor(openMinutes / 60),
        openMinutes % 60,
        timeZone
      );
      if (openInstant.getTime() > now.getTime()) return openInstant;
    }
  }
  return null;
}

function describeNextOpen(nextOpenAt: Date, now: Date, timeZone: string): string {
  const time = formatVenueLocalTime(nextOpenAt.toISOString(), timeZone);
  const next = zonedDateParts(nextOpenAt, timeZone);
  const today = zonedDateParts(now, timeZone);
  if (next.year === today.year && next.month === today.month && next.day === today.day) return `Opens ${time}`;

  const tomorrow = zonedDateParts(new Date(now.getTime() + 24 * 3_600_000), timeZone);
  if (next.year === tomorrow.year && next.month === tomorrow.month && next.day === tomorrow.day) {
    return `Opens tomorrow at ${time}`;
  }
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(nextOpenAt);
  return `Opens ${weekday} at ${time}`;
}

/**
 * The single richer "is this venue open" answer for UI display — built on top of
 * findOpenWindow/deriveVenueOpenState (which stay the one source of truth for the
 * isOpen boolean itself) rather than recomputing it. See spec §17.
 */
export function getVenueOpenStatus(
  hours: VenueHours[],
  specialHours: VenueSpecialHours[],
  now: Date,
  timeZone: string,
  businessStatus: BusinessStatus | null
): VenueOpenStatus {
  const effectiveHours = buildEffectiveHours(hours, specialHours, now, timeZone);
  const status = deriveVenueOpenState(effectiveHours, now, timeZone, businessStatus);
  const isOpen = status === "OPEN" || status === "CLOSING_SOON";

  const window = findOpenWindow(effectiveHours, now, timeZone);
  const closesAt =
    isOpen && window.minutesUntilClose !== null ? new Date(now.getTime() + window.minutesUntilClose * 60_000).toISOString() : null;
  const opensAt =
    isOpen && window.minutesSinceOpen !== null ? new Date(now.getTime() - window.minutesSinceOpen * 60_000).toISOString() : null;

  const nextOpenInstant =
    !isOpen && (status === "CLOSED" || status === "UNKNOWN") ? findNextOpenInstant(hours, specialHours, now, timeZone) : null;
  const nextOpenAt = nextOpenInstant ? nextOpenInstant.toISOString() : null;

  const today = zonedDateParts(now, timeZone);
  const prevDayOfWeek = (today.dayOfWeek + 6) % 7;
  const relevantRows = effectiveHours.filter((h) => h.dayOfWeek === today.dayOfWeek || h.dayOfWeek === prevDayOfWeek);
  const hoursConfidence = hoursConfidenceForRows(relevantRows, now);

  let displayText: string;
  if (status === "UNKNOWN") displayText = "Hours unknown";
  else if (status === "PERMANENTLY_CLOSED") displayText = "Permanently closed";
  else if (status === "TEMPORARILY_CLOSED") displayText = "Temporarily closed";
  else if (hoursConfidence === "LOW") displayText = "Hours may vary";
  else if (isOpen) displayText = closesAt ? `Open · Closes ${formatVenueLocalTime(closesAt, timeZone)}` : "Open now";
  else displayText = nextOpenInstant ? `Closed · ${describeNextOpen(nextOpenInstant, now, timeZone)}` : "Closed";

  return { isOpen, status, closesAt, opensAt, nextOpenAt, hoursConfidence, displayText };
}
