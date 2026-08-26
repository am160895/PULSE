import type { BadgeCode, UserNeighborhoodProgress, XpEvent } from "@/types";
import {
  CITY_SCOUT_MIN_NEIGHBORHOODS,
  DEMO_TIMEZONE,
  LINE_SAVER_MIN_COUNT,
  NEIGHBORHOOD_INSIDER_XP_THRESHOLD,
  NIGHT_OWL_MIN_COUNT,
  ON_THE_PULSE_DISTINCT_DAYS,
  TREND_SPOTTER_MIN_CONFIRMED,
} from "@/config/constants";
import { zonedDateParts, zonedParts } from "@/lib/time/zoned";
import { awardBadge, listRecentXpEventsForUser, listUserNeighborhoodProgress } from "@/lib/data/gamification";

export interface BadgeUnlock {
  code: BadgeCode;
  neighborhood: string;
  xpEventId: string | null;
}

const REPORT_REWARD_TYPES = new Set(["CROWD_REPORT", "WAIT_REPORT", "ENERGY_REPORT"]);
const NIGHT_OWL_START_HOUR = 1;
const NIGHT_OWL_END_HOUR = 4; // exclusive — 1:00-3:59 AM

// ---------------------------------------------------------------------------
// Pure rule checks — each takes the user's own recent events/neighborhood progress and
// answers "does this badge's condition currently hold," with no I/O. Kept separate from
// the DB-writing orchestration below specifically so these can be unit tested directly,
// matching this codebase's existing convention of testing domain logic as pure functions
// (see tests/presence.test.ts, tests/reports.test.ts) rather than mocking Supabase.
// ---------------------------------------------------------------------------

/** Returns the earliest report-shaped event if the user has ever submitted one — that
 * event is what FIRST_SIGNAL attaches to. */
export function firstSignalEvent(events: XpEvent[]): XpEvent | null {
  const reportEvents = events.filter((e) => REPORT_REWARD_TYPES.has(e.rewardType));
  if (reportEvents.length === 0) return null;
  return [...reportEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
}

export function lineSaverQualifies(events: XpEvent[]): boolean {
  const count = events.filter(
    (e) => e.rewardType === "WAIT_REPORT" && ["LONG", "VERY_LONG"].includes(String(e.metadata?.waitLevel))
  ).length;
  return count >= LINE_SAVER_MIN_COUNT;
}

export function nightOwlQualifies(events: XpEvent[], timeZone: string = DEMO_TIMEZONE): boolean {
  const count = events.filter((e) => {
    const { hour } = zonedParts(new Date(e.createdAt), timeZone);
    return hour >= NIGHT_OWL_START_HOUR && hour < NIGHT_OWL_END_HOUR;
  }).length;
  return count >= NIGHT_OWL_MIN_COUNT;
}

/** Redefined from a consecutive-weekend streak (out of scope for this pass) to a simple
 * distinct-nights-out count, so it's reachable without needing that mechanic. */
export function onThePulseQualifies(events: XpEvent[], timeZone: string = DEMO_TIMEZONE): boolean {
  const distinctDays = new Set(
    events.map((e) => {
      const d = zonedDateParts(new Date(e.createdAt), timeZone);
      return `${d.year}-${d.month}-${d.day}`;
    })
  );
  return distinctDays.size >= ON_THE_PULSE_DISTINCT_DAYS;
}

export function activeNeighborhoods(neighborhoods: UserNeighborhoodProgress[]): UserNeighborhoodProgress[] {
  return neighborhoods.filter((n) => n.xp > 0);
}

export function cityScoutQualifies(neighborhoods: UserNeighborhoodProgress[]): boolean {
  return activeNeighborhoods(neighborhoods).length >= CITY_SCOUT_MIN_NEIGHBORHOODS;
}

export function neighborhoodInsiderAreas(neighborhoods: UserNeighborhoodProgress[]): string[] {
  return neighborhoods.filter((n) => n.xp >= NEIGHBORHOOD_INSIDER_XP_THRESHOLD).map((n) => n.neighborhood);
}

export function trendSpotterQualifies(events: XpEvent[]): boolean {
  const count = events.filter(
    (e) => e.rewardType === "SIGNAL_CONFIRMED" && ["RISING", "RISING_FAST"].includes(String(e.metadata?.trendAtConfirmation))
  ).length;
  return count >= TREND_SPOTTER_MIN_CONFIRMED;
}

/** A FIRST_REPORT_TONIGHT report that was LATER also SIGNAL_CONFIRMED — first and right. */
export function earlySignalEvent(events: XpEvent[]): XpEvent | null {
  const firstReportSourceIds = new Set(events.filter((e) => e.rewardType === "FIRST_REPORT_TONIGHT").map((e) => e.sourceId));
  return events.find((e) => e.rewardType === "SIGNAL_CONFIRMED" && firstReportSourceIds.has(e.sourceId)) ?? null;
}

// ---------------------------------------------------------------------------
// Orchestration — fetches the user's data once, runs every rule, and idempotently
// awards whatever newly qualifies (awardBadge's unique-index guard makes re-running
// this after every contribution safe rather than needing to award "exactly once" here).
// ---------------------------------------------------------------------------

export async function evaluateBadges(userId: string, now: Date = new Date()): Promise<BadgeUnlock[]> {
  const [events, neighborhoods] = await Promise.all([
    listRecentXpEventsForUser(userId, now),
    listUserNeighborhoodProgress(userId),
  ]);

  const unlocks: BadgeUnlock[] = [];
  async function tryAward(code: BadgeCode, neighborhood: string, xpEventId: string | null) {
    const badge = await awardBadge(userId, code, neighborhood, xpEventId);
    if (badge) unlocks.push({ code, neighborhood, xpEventId });
  }

  const first = firstSignalEvent(events);
  if (first) await tryAward("FIRST_SIGNAL", "", first.id);

  if (lineSaverQualifies(events)) await tryAward("LINE_SAVER", "", null);
  if (nightOwlQualifies(events)) await tryAward("NIGHT_OWL", "", null);
  if (onThePulseQualifies(events)) await tryAward("ON_THE_PULSE", "", null);
  if (cityScoutQualifies(neighborhoods)) await tryAward("CITY_SCOUT", "", null);

  for (const neighborhood of neighborhoodInsiderAreas(neighborhoods)) {
    await tryAward("NEIGHBORHOOD_INSIDER", neighborhood, null);
  }

  if (trendSpotterQualifies(events)) await tryAward("TREND_SPOTTER", "", null);

  const earlySignal = earlySignalEvent(events);
  if (earlySignal) await tryAward("EARLY_SIGNAL", "", earlySignal.id);

  return unlocks;
}
