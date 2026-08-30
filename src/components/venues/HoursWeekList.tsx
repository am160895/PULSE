import type { VenueHours } from "@/types";
import { zonedParts } from "@/lib/time/zoned";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function lineForDay(hours: VenueHours[], dayOfWeek: number): string {
  const rows = hours.filter((h) => h.dayOfWeek === dayOfWeek);
  if (rows.length === 0) return "Hours unknown";
  if (rows.every((r) => r.isClosed)) return "Closed";
  return rows
    .filter((r) => !r.isClosed && r.openTime && r.closeTime)
    .map((r) => `${formatTime(r.openTime!)}–${formatTime(r.closeTime!)}`)
    .join(", ");
}

/**
 * The full Sun-Sat schedule, today highlighted — shared between the always-visible "Hours"
 * section on the venue page and WeeklyHoursSheet's modal (map bottom sheet still uses the
 * modal, since it has no room for an inline section). One rendering so the two never drift.
 */
export function HoursWeekList({ hours, timeZone }: { hours: VenueHours[]; timeZone: string }) {
  const today = zonedParts(new Date(), timeZone).dayOfWeek;

  return (
    <div className="flex flex-col gap-0.5">
      {DAY_LABELS.map((label, dayOfWeek) => {
        const isToday = dayOfWeek === today;
        return (
          <div
            key={dayOfWeek}
            className="flex items-center justify-between py-2 px-2.5 rounded-[var(--radius-xs)] text-[14px]"
            style={{
              background: isToday ? "var(--surface-2)" : "transparent",
              fontWeight: isToday ? 650 : 450,
            }}
          >
            <span>{label}</span>
            <span style={{ color: "var(--text-secondary)" }}>{lineForDay(hours, dayOfWeek)}</span>
          </div>
        );
      })}
    </div>
  );
}
