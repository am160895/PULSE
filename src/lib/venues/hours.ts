import type { VenueHours } from "@/types";
import { zonedParts } from "@/lib/time/zoned";

export interface OpenWindow {
  isOpenNow: boolean;
  minutesSinceOpen: number | null;
  minutesUntilClose: number | null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * The single source of truth for "is this venue open right now," given its weekly hours.
 * Both the scoring engine (signals/timeDecay.ts, which additionally ramps a 0-1 factor
 * on top) and the UI-facing open/closed state (venues/openState.ts) call this — keeping
 * one venue's hours logic in one place, per the product's own explicit warning against
 * "slightly different opening-hours logic in multiple components."
 */
export function findOpenWindow(hours: VenueHours[], now: Date, timeZone: string): OpenWindow {
  if (hours.length === 0) {
    return { isOpenNow: false, minutesSinceOpen: null, minutesUntilClose: null };
  }

  const zoned = zonedParts(now, timeZone);
  const nowMinutesToday = zoned.hour * 60 + zoned.minute;
  const dayOfWeek = zoned.dayOfWeek;
  const prevDayOfWeek = (dayOfWeek + 6) % 7;

  const todayHours = hours.filter((h) => h.dayOfWeek === dayOfWeek);
  const prevDayHours = hours.filter((h) => h.dayOfWeek === prevDayOfWeek);

  for (const h of todayHours) {
    const open = toMinutes(h.openTime);
    const close = toMinutes(h.closeTime);
    const crossesMidnight = close <= open;
    const effectiveClose = crossesMidnight ? close + 24 * 60 : close;

    if (nowMinutesToday >= open && nowMinutesToday < effectiveClose) {
      return {
        isOpenNow: true,
        minutesSinceOpen: nowMinutesToday - open,
        minutesUntilClose: effectiveClose - nowMinutesToday,
      };
    }
  }

  for (const h of prevDayHours) {
    const open = toMinutes(h.openTime);
    const close = toMinutes(h.closeTime);
    const crossesMidnight = close <= open;
    if (!crossesMidnight) continue;
    const nowMinutesFromPrevDayOpen = nowMinutesToday + 24 * 60;
    const effectiveClose = close + 24 * 60;
    if (nowMinutesFromPrevDayOpen >= open && nowMinutesFromPrevDayOpen < effectiveClose) {
      return {
        isOpenNow: true,
        minutesSinceOpen: nowMinutesFromPrevDayOpen - open,
        minutesUntilClose: effectiveClose - nowMinutesFromPrevDayOpen,
      };
    }
  }

  return { isOpenNow: false, minutesSinceOpen: null, minutesUntilClose: null };
}
