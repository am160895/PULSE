/**
 * One-time backfill: applies a typical-for-venue-type hours estimate (see
 * lib/venues/typicalHours.ts) to every venue that currently has NO hours on file at all —
 * mostly the real venues added via scripts/addRealVenues*.ts and the admin import tool,
 * which deliberately never fabricated real hours. This is the same source: "SEED" tag and
 * LOW hoursConfidence/"Hours may vary" treatment the app's original synthetic seed venues
 * already carry — an explicit product decision (see AskUserQuestion in this session) to
 * show an honestly-labeled estimate rather than nothing, given the scale (220+ venues)
 * makes hand-verifying every one impractical before launch. Venues that already have SOME
 * hours (even unverified SEED ones) are left untouched — this only fills genuine gaps.
 *
 * Run with: npm run backfill:hours
 */
import { listAllVenuesForAdmin, updateVenueAdmin } from "../src/lib/data/repository";
import { buildTypicalHours } from "../src/lib/venues/typicalHours";

const MAX_CONCURRENT = 5;

async function main() {
  const venues = await listAllVenuesForAdmin();
  const needsHours = venues.filter((v) => v.hours.length === 0);

  console.log(`${venues.length} total venues, ${needsHours.length} with no hours on file.`);

  let updated = 0;
  for (let i = 0; i < needsHours.length; i += MAX_CONCURRENT) {
    const chunk = needsHours.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      chunk.map(async (v) => {
        await updateVenueAdmin(v.id, { hours: buildTypicalHours(v.venueType) });
        updated++;
      })
    );
    console.log(`${updated}/${needsHours.length}...`);
  }

  console.log(`\nDone. ${updated} venues backfilled with estimated hours.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
