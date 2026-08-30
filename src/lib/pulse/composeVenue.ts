import type {
  ConfirmedSignal,
  CurrentPulseStatus,
  PulseResult,
  Venue,
  VenueCoverageState,
  VenueHourlyBaseline,
  VenueNightlyRollup,
  VenueOpenState,
  VenueOpenStatus,
  VsTypicalComparison,
} from "@/types";
import {
  appendSnapshot,
  appendSnapshotsBatch,
  listBaselinesForVenue,
  listBaselinesForVenues,
  listEventsForVenue,
  listEventsForVenues,
  listRecentRollupsForVenue,
  listRecentRollupsForVenues,
  listReportsForVenue,
  listReportsForVenues,
  listSnapshotHistory,
  listSnapshotHistoryForVenues,
  listSpecialHoursForVenue,
  listSpecialHoursForVenues,
} from "@/lib/data/repository";
import { allTrustScoresMap, countAnyPresentAtVenue, countPresentAtVenues } from "@/lib/data/social";
import { calculatePulseScore } from "./calculatePulseScore";
import { calculateVsTypicalSignal } from "./signals/vsTypical";
import { deriveVenueOpenState } from "@/lib/venues/openState";
import { deriveCoverageState } from "@/lib/venues/coverageState";
import { buildEffectiveHours } from "@/lib/venues/specialHours";
import { getVenueOpenStatus } from "@/lib/venues/getVenueOpenStatus";
import { currentPulseStatusFor } from "@/lib/venues/currentPulseStatus";
import { HOURS_DISCREPANCY_WINDOW_MINUTES, NIGHTLIFE_DAY_BOUNDARY_HOUR, ROLLUP_LOOKBACK_NIGHTS } from "@/config/constants";
import { evaluateOwnReportsForConsensus } from "@/lib/gamification/consensus";
import { evaluateBadges, type BadgeUnlock } from "@/lib/gamification/badges";
import { finalizeNightlyRollupsIfNeeded } from "./history/nightlyRollup";
import { nightlifeDayParts } from "@/lib/time/zoned";

const SNAPSHOT_MIN_INTERVAL_MINUTES = 2;

async function fetchSignals(venue: Venue, now: Date) {
  const [reports, baselines, events, history, friendsPresentCount, trustScores, specialHours] = await Promise.all([
    listReportsForVenue(venue.id),
    listBaselinesForVenue(venue.id),
    listEventsForVenue(venue.id),
    listSnapshotHistory(venue.id),
    countAnyPresentAtVenue(venue.id, now),
    allTrustScoresMap(),
    listSpecialHoursForVenue(venue.id, now),
  ]);
  return { reports, baselines, events, history, friendsPresentCount, trustScores, specialHours };
}

async function scoreAndMaybeSnapshot(
  venue: Venue,
  now: Date,
  signals: Awaited<ReturnType<typeof fetchSignals>>,
  effectiveHours: Venue["hours"]
): Promise<PulseResult> {
  const result = calculatePulseScore({ venue, now, ...signals, effectiveHours });

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
  const effectiveHours = buildEffectiveHours(venue.hours, signals.specialHours, now, venue.timezone);
  return scoreAndMaybeSnapshot(venue, now, signals, effectiveHours);
}

export interface VenueState {
  pulse: PulseResult;
  openState: VenueOpenState;
  coverageState: VenueCoverageState;
  openStatus: VenueOpenStatus;
  currentPulseStatus: CurrentPulseStatus;
  hoursDiscrepancy: boolean;
  /** Non-empty only when evaluateOwnReportsForConsensus (called when a viewerId is
   * given) actually awarded a new SIGNAL_CONFIRMED event THIS call — the UI uses this to
   * fire the "ACCURATE SIGNAL" contribution-success toast. */
  newlyConfirmedSignals: ConfirmedSignal[];
  /** Badges newly unlocked as a side effect of a fresh confirmation above — TREND_SPOTTER
   * and EARLY_SIGNAL both depend entirely on SIGNAL_CONFIRMED events existing, so they can
   * only ever unlock from this path (badges from I'm-Here/report submissions are evaluated
   * separately, right where those XP awards happen). Always [] when newlyConfirmedSignals
   * is empty — badges are only re-checked when there's genuinely new ledger activity. */
  newlyUnlockedBadges: BadgeUnlock[];
  /** null unless the venue is currently LIVE with real (non-DIRECTORY) data and enough
   * nightly-rollup history to compare against — see signals/vsTypical.ts. */
  vsTypical: VsTypicalComparison | null;
}

/** Never shows a comparison for a venue with no live score to compare (CLOSED/DIRECTORY)
 * — "22% busier than usual" is nonsensical when there's nothing current to measure. */
function deriveVsTypical(
  recentRollups: VenueNightlyRollup[],
  nightlifeDayOfWeek: number,
  currentPulseStatus: CurrentPulseStatus,
  coverageState: VenueCoverageState,
  pulseScore: number
): VsTypicalComparison | null {
  if (currentPulseStatus !== "LIVE" || coverageState === "DIRECTORY") return null;
  const sameWeekday = recentRollups.filter((r) => r.nightlifeDayOfWeek === nightlifeDayOfWeek).slice(0, ROLLUP_LOOKBACK_NIGHTS);
  return calculateVsTypicalSignal(sameWeekday, pulseScore);
}

function deriveDiscrepancy(
  currentPulseStatus: CurrentPulseStatus,
  reports: Awaited<ReturnType<typeof fetchSignals>>["reports"],
  now: Date
): boolean {
  if (currentPulseStatus !== "CLOSED") return false;
  return reports.some(
    (r) => r.isVerifiedNearby && (now.getTime() - new Date(r.createdAt).getTime()) / 60_000 <= HOURS_DISCREPANCY_WINDOW_MINUTES
  );
}

/** Everything needed to build a VenueWithPulse for the API layer, in one call — fetches each
 * signal exactly once (computePulseForVenue alone would refetch baselines a second time to
 * derive coverageState, doubling a now-real network round-trip for no reason).
 *
 * `viewerId`, when given, also evaluates whether any of the viewer's own recent reports at
 * this venue were just directionally confirmed by the crowd (see
 * lib/gamification/consensus.ts) — the delayed-accuracy-reward mechanism. Omit it for
 * unauthenticated/system callers that have no "viewer" to reward. */
export async function computeVenueState(venue: Venue, now: Date, viewerId?: string): Promise<VenueState> {
  // Archives the most-recently-completed nightlife-night if nobody has yet — see
  // history/nightlyRollup.ts. Runs before this call's own snapshot append/prune
  // (inside scoreAndMaybeSnapshot below), so this request's own pruning can't delete
  // snapshots finalize still needs.
  await finalizeNightlyRollupsIfNeeded([venue], now);

  const signals = await fetchSignals(venue, now);
  const effectiveHours = buildEffectiveHours(venue.hours, signals.specialHours, now, venue.timezone);
  const pulse = await scoreAndMaybeSnapshot(venue, now, signals, effectiveHours);
  const openState = deriveVenueOpenState(effectiveHours, now, venue.timezone, venue.businessStatus);
  const coverageState = deriveCoverageState((signals.baselines as VenueHourlyBaseline[]).length > 0, pulse.freshness);
  const openStatus = getVenueOpenStatus(venue.hours, signals.specialHours, now, venue.timezone, venue.businessStatus);
  const currentPulseStatus = currentPulseStatusFor(openState);
  const hoursDiscrepancy = deriveDiscrepancy(currentPulseStatus, signals.reports, now);

  const recentRollups = await listRecentRollupsForVenue(venue.id, now);
  const nightlifeDayOfWeek = nightlifeDayParts(now, venue.timezone, NIGHTLIFE_DAY_BOUNDARY_HOUR).nightlifeDayOfWeek;
  const vsTypical = deriveVsTypical(recentRollups, nightlifeDayOfWeek, currentPulseStatus, coverageState, pulse.pulseScore);

  const newlyConfirmedSignals = viewerId
    ? await evaluateOwnReportsForConsensus(viewerId, venue, signals.reports, now, pulse.trend)
    : [];
  const newlyUnlockedBadges = newlyConfirmedSignals.length > 0 ? await evaluateBadges(viewerId!, now) : [];

  return { pulse, openState, coverageState, openStatus, currentPulseStatus, hoursDiscrepancy, vsTypical, newlyConfirmedSignals, newlyUnlockedBadges };
}

/**
 * Batched sibling of computeVenueState — scores N venues with ~9 total Supabase round-trips
 * instead of ~7*N. Once each venue's signals cost a real network call instead of a free
 * in-memory lookup (post-Supabase-migration), scoring every venue visible on the map one at
 * a time made the initial map load scale directly with venue count — 140 venues meant ~840
 * individual requests, observed taking 20+ seconds in production. Use this for any endpoint
 * that scores a list of venues at once (map bounds, explore, saved, nearby-alternatives);
 * keep computeVenueState/computePulseForVenue for genuine single-venue call sites where
 * there's nothing to batch against.
 *
 * `viewerId`, when given, evaluates delayed-accuracy consensus for every venue in the
 * batch — cheap, since each venue's reports are already fetched for scoring regardless
 * (see lib/gamification/consensus.ts). This is what lets browsing the map itself resolve
 * a pending confirmation, not just revisiting one venue's detail page.
 */
export async function computeVenueStatesBatch(venues: Venue[], now: Date, viewerId?: string): Promise<Map<string, VenueState>> {
  // See computeVenueState's identical call — must finish before this batch's own
  // snapshot pruning (inside appendSnapshotsBatch, called at the end of this function).
  await finalizeNightlyRollupsIfNeeded(venues, now);

  const ids = venues.map((v) => v.id);
  const [reportsByVenue, baselinesByVenue, eventsByVenue, historyByVenue, presenceByVenue, trustScores, specialHoursByVenue, rollupsByVenue] =
    await Promise.all([
      listReportsForVenues(ids),
      listBaselinesForVenues(ids),
      listEventsForVenues(ids),
      listSnapshotHistoryForVenues(ids, now),
      countPresentAtVenues(ids, now),
      allTrustScoresMap(),
      listSpecialHoursForVenues(ids, now),
      listRecentRollupsForVenues(ids, now),
    ]);

  const snapshotsToWrite: Array<{ venueId: string; result: PulseResult }> = [];
  const states = new Map<string, VenueState>();

  for (const venue of venues) {
    const reports = reportsByVenue.get(venue.id) ?? [];
    const baselines = baselinesByVenue.get(venue.id) ?? [];
    const events = eventsByVenue.get(venue.id) ?? [];
    const history = historyByVenue.get(venue.id) ?? [];
    const friendsPresentCount = presenceByVenue.get(venue.id) ?? 0;
    const specialHours = specialHoursByVenue.get(venue.id) ?? [];
    const effectiveHours = buildEffectiveHours(venue.hours, specialHours, now, venue.timezone);

    const pulse = calculatePulseScore({ venue, now, reports, baselines, events, friendsPresentCount, history, trustScores, effectiveHours });

    const last = [...history].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
    const minutesSinceLast = last ? (now.getTime() - new Date(last.capturedAt).getTime()) / 60_000 : Infinity;
    if (minutesSinceLast >= SNAPSHOT_MIN_INTERVAL_MINUTES) {
      snapshotsToWrite.push({ venueId: venue.id, result: pulse });
    }

    const openState = deriveVenueOpenState(effectiveHours, now, venue.timezone, venue.businessStatus);
    const coverageState = deriveCoverageState(baselines.length > 0, pulse.freshness);
    const openStatus = getVenueOpenStatus(venue.hours, specialHours, now, venue.timezone, venue.businessStatus);
    const currentPulseStatus = currentPulseStatusFor(openState);
    const hoursDiscrepancy = deriveDiscrepancy(currentPulseStatus, reports, now);

    const rollups = rollupsByVenue.get(venue.id) ?? [];
    const nightlifeDayOfWeek = nightlifeDayParts(now, venue.timezone, NIGHTLIFE_DAY_BOUNDARY_HOUR).nightlifeDayOfWeek;
    const vsTypical = deriveVsTypical(rollups, nightlifeDayOfWeek, currentPulseStatus, coverageState, pulse.pulseScore);

    const newlyConfirmedSignals = viewerId ? await evaluateOwnReportsForConsensus(viewerId, venue, reports, now, pulse.trend) : [];
    const newlyUnlockedBadges = newlyConfirmedSignals.length > 0 ? await evaluateBadges(viewerId!, now) : [];

    states.set(venue.id, {
      pulse,
      openState,
      coverageState,
      openStatus,
      currentPulseStatus,
      hoursDiscrepancy,
      vsTypical,
      newlyConfirmedSignals,
      newlyUnlockedBadges,
    });
  }

  await appendSnapshotsBatch(snapshotsToWrite);

  return states;
}
