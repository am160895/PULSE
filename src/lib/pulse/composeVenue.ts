import type { PulseResult, Venue, VenueCoverageState, VenueHourlyBaseline, VenueOpenState } from "@/types";
import {
  appendSnapshot,
  appendSnapshotsBatch,
  listBaselinesForVenue,
  listBaselinesForVenues,
  listEventsForVenue,
  listEventsForVenues,
  listReportsForVenue,
  listReportsForVenues,
  listSnapshotHistory,
  listSnapshotHistoryForVenues,
} from "@/lib/data/repository";
import { allTrustScoresMap, countAnyPresentAtVenue, countPresentAtVenues } from "@/lib/data/social";
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

/**
 * Batched sibling of computeVenueState — scores N venues with ~8 total Supabase round-trips
 * instead of ~6*N. Once each venue's signals cost a real network call instead of a free
 * in-memory lookup (post-Supabase-migration), scoring every venue visible on the map one at
 * a time made the initial map load scale directly with venue count — 140 venues meant ~840
 * individual requests, observed taking 20+ seconds in production. Use this for any endpoint
 * that scores a list of venues at once (map bounds, explore, saved, nearby-alternatives);
 * keep computeVenueState/computePulseForVenue for genuine single-venue call sites (venue
 * detail page, report submission) where there's nothing to batch against.
 */
export async function computeVenueStatesBatch(venues: Venue[], now: Date): Promise<Map<string, VenueState>> {
  const ids = venues.map((v) => v.id);
  const [reportsByVenue, baselinesByVenue, eventsByVenue, historyByVenue, presenceByVenue, trustScores] =
    await Promise.all([
      listReportsForVenues(ids),
      listBaselinesForVenues(ids),
      listEventsForVenues(ids),
      listSnapshotHistoryForVenues(ids),
      countPresentAtVenues(ids, now),
      allTrustScoresMap(),
    ]);

  const snapshotsToWrite: Array<{ venueId: string; result: PulseResult }> = [];
  const states = new Map<string, VenueState>();

  for (const venue of venues) {
    const reports = reportsByVenue.get(venue.id) ?? [];
    const baselines = baselinesByVenue.get(venue.id) ?? [];
    const events = eventsByVenue.get(venue.id) ?? [];
    const history = historyByVenue.get(venue.id) ?? [];
    const friendsPresentCount = presenceByVenue.get(venue.id) ?? 0;

    const pulse = calculatePulseScore({ venue, now, reports, baselines, events, friendsPresentCount, history, trustScores });

    const last = [...history].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
    const minutesSinceLast = last ? (now.getTime() - new Date(last.capturedAt).getTime()) / 60_000 : Infinity;
    if (minutesSinceLast >= SNAPSHOT_MIN_INTERVAL_MINUTES) {
      snapshotsToWrite.push({ venueId: venue.id, result: pulse });
    }

    const openState = deriveVenueOpenState(venue.hours, now, venue.timezone, venue.businessStatus);
    const coverageState = deriveCoverageState(baselines.length > 0, pulse.freshness);
    states.set(venue.id, { pulse, openState, coverageState });
  }

  await appendSnapshotsBatch(snapshotsToWrite);

  return states;
}
