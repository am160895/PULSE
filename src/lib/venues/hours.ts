import type { VenueHours } from "@/types";
import { nextCalendarDate, previousCalendarDate, zonedDateParts, zonedDateToUtc } from "@/lib/time/zoned";

export interface OpenWindow {
  isOpenNow: boolean;
  minutesSinceOpen: number | null;
  minutesUntilClose: number | null;
}

function toHourMinute(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(":").map(Number);
  return { hour, minute };
}

/**
 * The single source of truth for "is this venue open right now," given its weekly hours.
 * Both the scoring engine (signals/timeDecay.ts, which additionally ramps a 0-1 factor
 * on top) and the UI-facing open/closed state (venues/openState.ts) call this — keeping
 * one venue's hours logic in one place, per the product's own explicit warning against
 * "slightly different opening-hours logic in multiple components."
 *
 * Works entirely in real UTC instants (via zonedDateToUtc), not wall-clock minutes-since-
 * midnight — a venue's open/close boundary is resolved to an actual instant in its own
 * timezone first, then compared/diffed against `now` in real milliseconds. This matters
 * specifically for the ~1-2 nights/year an overnight-crossing window (e.g. Fri 10pm-3am)
 * spans a DST transition: treating every calendar day as a fixed 1440 minutes of real time
 * (the previous approach) is off by up to an hour on exactly those nights, both for the
 * displayed close time and for the CLOSING_SOON threshold check downstream.
 */
export function findOpenWindow(hours: VenueHours[], now: Date, timeZone: string): OpenWindow {
  if (hours.length === 0) {
    return { isOpenNow: false, minutesSinceOpen: null, minutesUntilClose: null };
  }

  const today = zonedDateParts(now, timeZone);
  const dayOfWeek = today.dayOfWeek;
  const prevDayOfWeek = (dayOfWeek + 6) % 7;
  const prevDate = previousCalendarDate(today);
  const nowMs = now.getTime();

  // A row with isClosed=true (an explicit "we verified this venue is closed Mondays," not
  // just the absence of a row) has null open/close times by construction — skip it rather
  // than treat it as an all-day window.
  const todayHours = hours.filter((h) => h.dayOfWeek === dayOfWeek && !h.isClosed && h.openTime && h.closeTime);
  const prevDayHours = hours.filter((h) => h.dayOfWeek === prevDayOfWeek && !h.isClosed && h.openTime && h.closeTime);

  for (const h of todayHours) {
    const open = toHourMinute(h.openTime!);
    const close = toHourMinute(h.closeTime!);
    const crossesMidnight = close.hour * 60 + close.minute <= open.hour * 60 + open.minute;
    const closeDate = crossesMidnight ? nextCalendarDate(today) : today;

    const openInstant = zonedDateToUtc(today.year, today.month, today.day, open.hour, open.minute, timeZone);
    const closeInstant = zonedDateToUtc(closeDate.year, closeDate.month, closeDate.day, close.hour, close.minute, timeZone);

    if (nowMs >= openInstant.getTime() && nowMs < closeInstant.getTime()) {
      return {
        isOpenNow: true,
        minutesSinceOpen: (nowMs - openInstant.getTime()) / 60_000,
        minutesUntilClose: (closeInstant.getTime() - nowMs) / 60_000,
      };
    }
  }

  for (const h of prevDayHours) {
    const open = toHourMinute(h.openTime!);
    const close = toHourMinute(h.closeTime!);
    const crossesMidnight = close.hour * 60 + close.minute <= open.hour * 60 + open.minute;
    if (!crossesMidnight) continue;

    const openInstant = zonedDateToUtc(prevDate.year, prevDate.month, prevDate.day, open.hour, open.minute, timeZone);
    const closeInstant = zonedDateToUtc(today.year, today.month, today.day, close.hour, close.minute, timeZone);

    if (nowMs >= openInstant.getTime() && nowMs < closeInstant.getTime()) {
      return {
        isOpenNow: true,
        minutesSinceOpen: (nowMs - openInstant.getTime()) / 60_000,
        minutesUntilClose: (closeInstant.getTime() - nowMs) / 60_000,
      };
    }
  }

  return { isOpenNow: false, minutesSinceOpen: null, minutesUntilClose: null };
}
