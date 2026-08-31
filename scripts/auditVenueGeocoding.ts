/**
 * Sanity-checks every active venue's stored lat/lng against a fresh Nominatim geocode of
 * its own street address — flags anything more than FLAG_THRESHOLD_METERS away as a likely
 * bad pin (wrong building, wrong street, or a geocode that landed on the wrong city/state
 * entirely). Read-only: reports mismatches, never overwrites coordinates itself, since
 * picking which of two sources is right needs a human look, not a blind script.
 *
 * A single Nominatim call isn't reliable enough to act on alone — geocoding the exact same
 * address twice can return different results (house-number interpolation isn't always
 * deterministic), and a failed house-number match can silently fall back to a much
 * lower-precision street-level point. So anything that looks mislocated gets a SECOND,
 * independent confirmation call before it's reported — only flagged if both checks agree
 * it's far from the stored point, which is what actually separates a real bad pin from
 * geocoder noise (confirmed by hand against this exact script's first run: 2 of 3 "flagged"
 * venues matched the stored coordinates exactly on re-check, and the third's "correction"
 * was a lower-quality street-centroid fallback, not a real improvement).
 *
 * Paced conservatively (well under Nominatim's 1 req/sec ceiling, with a longer pause every
 * BATCH_SIZE requests) — this session's earlier back-to-back script runs against the same
 * free public instance appear to have triggered its informal abuse/rate protection, which
 * a same-run retry alone couldn't recover from.
 *
 * Run with: npm run audit:geo
 */
import { listAllVenuesForAdmin } from "../src/lib/data/repository";
import { geocode } from "../src/lib/geo/nominatim";
import { haversineDistanceMeters } from "../src/lib/geo";

const FLAG_THRESHOLD_METERS = 300;
// Two results agreeing within this tolerance of EACH OTHER (not just both far from the
// stored point) is what makes a flag trustworthy — otherwise two independently-noisy
// results could each be far from storage yet also far from each other, which isn't
// evidence of anything.
const CONFIRMATION_AGREEMENT_METERS = 150;
const REQUEST_DELAY_MS = 2000;
const BATCH_SIZE = 40;
const BATCH_PAUSE_MS = 20_000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const venues = await listAllVenuesForAdmin();
  console.log(`Checking ${venues.length} venues (paced well under Nominatim's rate limit — this will take a while)...\n`);

  const flagged: Array<{ name: string; address: string; distanceMeters: number; stored: string; geocoded: string }> = [];
  const inconclusive: Array<{ name: string; address: string }> = [];
  let noResult = 0;

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    if (i > 0 && i % BATCH_SIZE === 0) {
      console.log(`...pausing ${BATCH_PAUSE_MS / 1000}s after ${i} checked...`);
      await sleep(BATCH_PAUSE_MS);
    }
    await sleep(REQUEST_DELAY_MS);

    const address = `${venue.streetAddress}, ${venue.city}, ${venue.state} ${venue.postalCode}`;
    const result = await geocode(address);
    if (!result) {
      console.log(`No geocode result (skipped): ${venue.name} — ${address}`);
      noResult++;
      continue;
    }

    const distanceMeters = haversineDistanceMeters({ lat: venue.latitude, lng: venue.longitude }, { lat: result.lat, lng: result.lng });
    if (distanceMeters <= FLAG_THRESHOLD_METERS) continue;

    // Worth a second look before reporting — see the header comment on why one call alone
    // isn't trustworthy enough to act on.
    await sleep(REQUEST_DELAY_MS);
    const confirm = await geocode(address);
    if (!confirm) {
      inconclusive.push({ name: venue.name, address });
      continue;
    }

    const confirmDistanceFromStored = haversineDistanceMeters({ lat: venue.latitude, lng: venue.longitude }, { lat: confirm.lat, lng: confirm.lng });
    const agreementBetweenChecks = haversineDistanceMeters({ lat: result.lat, lng: result.lng }, { lat: confirm.lat, lng: confirm.lng });

    if (confirmDistanceFromStored <= FLAG_THRESHOLD_METERS || agreementBetweenChecks > CONFIRMATION_AGREEMENT_METERS) {
      // Either the second call landed back near the stored point (first call was noise),
      // or the two calls disagree with each other too much to trust either — not a real flag.
      continue;
    }

    flagged.push({
      name: venue.name,
      address,
      distanceMeters: Math.round(distanceMeters),
      stored: `${venue.latitude}, ${venue.longitude}`,
      geocoded: `${result.lat}, ${result.lng}`,
    });
    console.log(`FLAGGED (${Math.round(distanceMeters)}m off, confirmed twice): ${venue.name} — ${address}`);
  }

  console.log(
    `\nDone. ${venues.length} checked, ${flagged.length} flagged (>${FLAG_THRESHOLD_METERS}m off, confirmed by 2 independent calls), ` +
      `${inconclusive.length} inconclusive (flagged once but couldn't get a confirming second call), ${noResult} had no geocode result at all.`
  );
  if (flagged.length > 0) {
    console.log("\nFlagged venues:");
    for (const f of flagged) {
      console.log(`- ${f.name}: stored (${f.stored}) vs geocoded (${f.geocoded}) — ${f.distanceMeters}m apart — ${f.address}`);
    }
  }
  if (inconclusive.length > 0) {
    console.log("\nInconclusive (worth a manual look, not auto-flagged):");
    for (const v of inconclusive) {
      console.log(`- ${v.name} — ${v.address}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
