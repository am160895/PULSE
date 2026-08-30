/**
 * Sanity-checks every active venue's stored lat/lng against a fresh Nominatim geocode of
 * its own street address — flags anything more than FLAG_THRESHOLD_METERS away as a likely
 * bad pin (wrong building, wrong street, or a geocode that landed on the wrong city/state
 * entirely). Read-only: reports mismatches, never overwrites coordinates itself, since
 * picking which of two sources is right needs a human look, not a blind script.
 *
 * Run with: npm run audit:geo
 */
import { listAllVenuesForAdmin } from "../src/lib/data/repository";
import { geocode } from "../src/lib/geo/nominatim";
import { haversineDistanceMeters } from "../src/lib/geo";

const FLAG_THRESHOLD_METERS = 300;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const venues = await listAllVenuesForAdmin();
  console.log(`Checking ${venues.length} venues (Nominatim, 1 req/sec — this will take a while)...\n`);

  const flagged: Array<{ name: string; address: string; distanceMeters: number; stored: string; geocoded: string }> = [];
  let noResult = 0;

  for (const venue of venues) {
    await sleep(1100); // Nominatim's 1 req/sec policy
    const address = `${venue.streetAddress}, ${venue.city}, ${venue.state} ${venue.postalCode}`;
    const result = await geocode(address);
    if (!result) {
      console.log(`No geocode result (skipped): ${venue.name} — ${address}`);
      noResult++;
      continue;
    }

    const distanceMeters = haversineDistanceMeters(
      { lat: venue.latitude, lng: venue.longitude },
      { lat: result.lat, lng: result.lng }
    );

    if (distanceMeters > FLAG_THRESHOLD_METERS) {
      flagged.push({
        name: venue.name,
        address,
        distanceMeters: Math.round(distanceMeters),
        stored: `${venue.latitude}, ${venue.longitude}`,
        geocoded: `${result.lat}, ${result.lng}`,
      });
      console.log(`FLAGGED (${Math.round(distanceMeters)}m off): ${venue.name} — ${address}`);
    }
  }

  console.log(`\nDone. ${venues.length} checked, ${flagged.length} flagged (>${FLAG_THRESHOLD_METERS}m off), ${noResult} had no geocode result.`);
  if (flagged.length > 0) {
    console.log("\nFlagged venues:");
    for (const f of flagged) {
      console.log(`- ${f.name}: stored (${f.stored}) vs geocoded (${f.geocoded}) — ${f.distanceMeters}m apart — ${f.address}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
