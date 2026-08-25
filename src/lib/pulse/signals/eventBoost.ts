import type { VenueEvent } from "@/types";

const MAX_EVENT_COMPONENT_BOOST = 22; // points above the neutral midpoint (50) — modifies expectation, never alone creates "hot"

export interface EventSignalOutput {
  eventComponentScore: number; // 0-100, 50 = no active/upcoming event
  activeEvent: VenueEvent | null;
}

export function calculateEventSignal(events: VenueEvent[], now: Date): EventSignalOutput {
  const active = events.find((e) => {
    const starts = new Date(e.startsAt).getTime();
    const ends = new Date(e.endsAt).getTime();
    return now.getTime() >= starts && now.getTime() <= ends;
  });

  const upcomingSoon = events.find((e) => {
    const starts = new Date(e.startsAt).getTime();
    const minutesUntil = (starts - now.getTime()) / 60_000;
    return minutesUntil > 0 && minutesUntil <= 60;
  });

  const relevant = active ?? upcomingSoon ?? null;

  if (!relevant) {
    return { eventComponentScore: 50, activeEvent: null };
  }

  const boost = active ? MAX_EVENT_COMPONENT_BOOST : MAX_EVENT_COMPONENT_BOOST * 0.5;
  return { eventComponentScore: Math.min(100, 50 + boost), activeEvent: relevant };
}
