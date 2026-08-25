import type { PulseResult, Venue, VenueCoverageState, VenueHourlyBaseline, VenueOpenState } from "@/types";
import {
  appendSnapshot,
  listBaselinesForVenue,
  listEventsForVenue,
  listReportsForVenue,
  listSnapshotHistory,
} from "@/lib/data/repository";
import { allTrustScoresMap, countAnyPresentAtVenue } from "@/lib/data/social";
import { calculatePulseScore } from "./calculatePulseScore";
import { deriveVenueOpenState } from "@/lib/venues/openState";
import { deriveCoverageState } from "@/lib/venues/coverageState";

const SNAPSHOT_MIN_INTERVAL_MINUTES = 2;

async function fetchSignals(venue: Venue, now: Date) {
  const [reports, baselines, events, history, friendsPresentCount, trustScores] = await Promise.all([
    listReportsForVenue(venue.id),
    listBaselinesForVenue(venue.id),
    listEventsForVenue(venue.id),
    listSnapshotHistory(venue.id),
    countAnyPresentAtVenue(venue.id, now),
    allTrustScoresMap(),
  ]);
  return { reports, baselines, events, history, friendsPresentCount, trustScores };
}

async function scoreAndMaybeSnapshot(
  venue: Venue,
  now: Date,
  signals: Awaited<ReturnType<typeof fetchSignals>>
): Promise<PulseResult> {
  const result = calculatePulseScore({ venue, now, ...signals });

  const last = [...signals.history].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  )[0];
  const minutesSinceLast = last ? (now.getTime() - new Date(last.capturedAt).getTime()) / 60_000 : Infinity;

  // Don't write a new snapshot on every single page view — only often enough to keep
  // trend/smoothing meaningful, so a busy demo session doesn't flood the table.
  if (minutesSinceLast >= SNAPSHOT_MIN_INTERVAL_MINUTES) {
    await appendSnapshot(venue.id, result);
  }

  return result;
}

/** The one place API routes go to get a venue's current score — keeps snapshot-append throttling in one spot. */
export async function computePulseForVenue(venue: Venue, now: Date): Promise<PulseResult> {
  const signals = await fetchSignals(venue, now);
  return scoreAndMaybeSnapshot(venue, now, signals);
}

export interface VenueState {
  pulse: PulseResult;
  openState: VenueOpenState;
  coverageState: VenueCoverageState;
}

/** Everything needed to build a VenueWithPulse for the API layer, in one call — fetches each
 * signal exactly once (computePulseForVenue alone would refetch baselines a second time to
 * derive coverageState, doubling a now-real network round-trip for no reason). */
export async function computeVenueState(venue: Venue, now: Date): Promise<VenueState> {
  const signals = await fetchSignals(venue, now);
  const pulse = await scoreAndMaybeSnapshot(venue, now, signals);
  const openState = deriveVenueOpenState(venue.hours, now, venue.timezone, venue.businessStatus);
  const coverageState = deriveCoverageState((signals.baselines as VenueHourlyBaseline[]).length > 0, pulse.freshness);
  return { pulse, openState, coverageState };
}
