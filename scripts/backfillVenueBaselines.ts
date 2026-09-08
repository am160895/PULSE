/**
 * One-time backfill: applies a category-typical hour-of-day/day-of-week activity curve
 * (see lib/simulation/activityCurve.ts — the exact same heuristic the original demo seed
 * used, never applied to real venues) to every venue that currently has NO
 * venue_hourly_baselines rows at all. This is every real venue added via
 * scripts/addRealVenues*.ts, addIrishBarsBatch.ts, and addVenueDirectoryBatch.ts — none of
 * them ever wrote baseline rows, so every real venue reads coverageState: DIRECTORY and
 * signalHealth: INSUFFICIENT regardless of time of day, and the pulse score's historical
 * component is a flat fallback (30) for all of them.
 *
 * sampleCount is deliberately 1 on every row, exactly matching the original seed's own
 * convention ("this is a category-typical estimate, not measured history — confidence
 * should say so") — calculateConfidenceSignal's historicalSampleFactor stays low/honest
 * with no changes needed to any already-shipped confidence/coverageState/signalHealth
 * code, since all three already correctly consume whatever's actually in the table.
 *
 * Idempotent: a venue that already has even one baseline row (e.g. hand-entered later)
 * is skipped entirely, so this is safe to re-run.
 *
 * Run with: npm run backfill:baselines
 */
import { insertBaselinesForVenue, listAllVenuesForAdmin, listBaselinesForVenues } from "../src/lib/data/repository";
import { expectedActivityScore, expectedWaitScore } from "../src/lib/simulation/activityCurve";

const MAX_CONCURRENT = 5;

async function main() {
  const venues = await listAllVenuesForAdmin();
  const existing = await listBaselinesForVenues(venues.map((v) => v.id));
  const needsBaselines = venues.filter((v) => (existing.get(v.id)?.length ?? 0) === 0);

  console.log(`${venues.length} total venues, ${needsBaselines.length} with no baseline rows.`);

  let done = 0;
  for (let i = 0; i < needsBaselines.length; i += MAX_CONCURRENT) {
    const chunk = needsBaselines.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      chunk.map(async (venue) => {
        const seed = venue.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
        const rows = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const activity = expectedActivityScore(venue.venueType, seed, day, hour);
            rows.push({
              dayOfWeek: day,
              hourOfDay: hour,
              expectedActivityScore: activity,
              expectedWaitScore: expectedWaitScore(activity),
              sampleCount: 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        await insertBaselinesForVenue(venue.id, rows);
        done++;
      })
    );
    console.log(`${done}/${needsBaselines.length}...`);
  }

  console.log(`\nDone. ${done} venues backfilled with estimated hourly baselines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
