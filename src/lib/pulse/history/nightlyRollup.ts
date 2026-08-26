import type { Venue } from "@/types";
import { nightlifeDayParts, previousCalendarDate, formatDate, zonedDateToUtc } from "@/lib/time/zoned";
import { NIGHTLIFE_DAY_BOUNDARY_HOUR } from "@/config/constants";
import { computeAndInsertNightlyRollup, getMissingRollupVenueIds } from "@/lib/data/repository";

// Same defensive cap this codebase already uses for fanning out Supabase calls (see
// repository.ts's fetchAllRows) — an uncapped Promise.all over every missing venue on
// the first request of a new nightlife day (which could be an entire map load's worth)
// risks the same silent-truncation-under-load failure mode already found and fixed once
// this session, for no benefit: this work is one-time-per-venue-per-night, not latency-
// sensitive the way a page's own data fetch is.
const MAX_CONCURRENT_ROLLUP_WRITES = 5;

function groupByTimezone(venues: Venue[]): Map<string, Venue[]> {
  const groups = new Map<string, Venue[]>();
  for (const venue of venues) {
    const list = groups.get(venue.timezone);
    if (list) list.push(venue);
    else groups.set(venue.timezone, [venue]);
  }
  return groups;
}

/**
 * Archives the most-recently-completed nightlife-night's activity into
 * venue_nightly_rollups for any venue that doesn't have one yet — the one-time
 * request-triggered mechanism that lets venue_signal_snapshots' 12-hour pruning coexist
 * with "PULSE remembers history." Follows lib/gamification/consensus.ts's exact shape:
 * a cheap batched existence check first (the common case, after the first call of a new
 * nightlife day, is zero missing venues — one query, nothing written), then bounded,
 * idempotent writes only for what's actually missing.
 *
 * Accepted gap, same tradeoff as consensus.ts's: only ever finalizes the SINGLE most-
 * recently-completed night. A venue with no traffic for more than roughly a day can
 * permanently lose that night's rollup — its raw snapshots get pruned before finalize
 * ever gets a chance to run for it. The real fix is a scheduled sweep independent of any
 * request; out of scope until this app has cron infrastructure at all.
 */
export async function finalizeNightlyRollupsIfNeeded(venues: Venue[], now: Date): Promise<void> {
  for (const [timezone, group] of groupByTimezone(venues)) {
    const current = nightlifeDayParts(now, timezone, NIGHTLIFE_DAY_BOUNDARY_HOUR);
    const prev = previousCalendarDate(current);
    const prevNightlifeDate = formatDate(prev);
    const prevDow = (current.nightlifeDayOfWeek + 6) % 7;

    const missing = await getMissingRollupVenueIds(
      group.map((v) => v.id),
      prevNightlifeDate
    );
    if (missing.size === 0) continue;

    const windowStart = zonedDateToUtc(prev.year, prev.month, prev.day, NIGHTLIFE_DAY_BOUNDARY_HOUR, 0, timezone);
    const windowEnd = zonedDateToUtc(current.year, current.month, current.day, NIGHTLIFE_DAY_BOUNDARY_HOUR, 0, timezone);

    const missingIds = [...missing];
    for (let i = 0; i < missingIds.length; i += MAX_CONCURRENT_ROLLUP_WRITES) {
      const chunk = missingIds.slice(i, i + MAX_CONCURRENT_ROLLUP_WRITES);
      await Promise.all(chunk.map((venueId) => computeAndInsertNightlyRollup(venueId, prevNightlifeDate, prevDow, windowStart, windowEnd)));
    }
  }
}
