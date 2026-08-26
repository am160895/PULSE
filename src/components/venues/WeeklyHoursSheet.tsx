"use client";

import { X } from "lucide-react";
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

interface Props {
  hours: VenueHours[];
  timeZone: string;
  onClose: () => void;
}

/** Tapping the hours line on the venue sheet opens this — the full weekly schedule with
 * today highlighted (spec §24/§25). */
export function WeeklyHoursSheet({ hours, timeZone, onClose }: Props) {
  const today = zonedParts(new Date(), timeZone).dayOfWeek;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 pb-16" onClick={onClose}>
      <div className="venue-sheet w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Close">
          <X size={18} />
        </button>
        <div className="px-5 pb-6 pt-1">
          <h3 className="mb-4">Hours</h3>
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
        </div>
      </div>
    </div>
  );
}
