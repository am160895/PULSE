/**
 * Finds and removes duplicate venues created by repeated imports across different batches
 * (100-bar list, Irish batch, 351-venue directory, admin manual entries) using different
 * exact spellings for the same real place — e.g. "230 Fifth" / "230 Fifth Rooftop Bar", or
 * an apostrophe-style mismatch like "O'Hara's Downtown" / "O'Haras Downtown".
 *
 * Detection deliberately requires BOTH signals to agree before flagging a pair, not just
 * one:
 *   1. Very close proximity (<= PROXIMITY_THRESHOLD_METERS) — on its own this over-flags,
 *      since real, distinct bars regularly sit within 80m of each other on a single dense
 *      NYC block.
 *   2. Similar names after normalization (exact match, or one is a prefix of the other) —
 *      on its own this over-flags too, since the same brand can have multiple real
 *      locations (e.g. "Dante" vs "Dante West Village" are two different real bars) — those
 *      never cluster by proximity since they're actually at different addresses.
 * Requiring both cuts false positives a lot: same-brand-different-location pairs don't
 * share proximity, and same-block-different-bar pairs don't share a name.
 *
 * A cluster is only auto-resolved if AT LEAST ONE member has a real, specific street
 * address (starts with a digit) — not just a vague/landmark-style geocode fallback like
 * "The Garret, New York" with no street number. Two vague geocodes landing close together
 * isn't strong enough evidence on its own; those clusters are reported but left alone.
 *
 * Within a resolvable cluster, keeps exactly one venue (deletes the rest — cascades away
 * that record's own hours/reports/snapshots, but if a rival copy in the same cluster has
 * a real address, real hours, etc., that data survives on the keeper), by preference:
 *   1. Real (ADMIN/VENUE_OWNER-sourced) hours over estimated/none
 *   2. A real, digit-leading street address over a vague one
 *   3. Earlier createdAt (the first-imported copy)
 *
 * Run with: npm run dedupe:venues
 */
import { listAllVenuesForAdmin } from "../src/lib/data/repository";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { haversineDistanceMeters } from "../src/lib/geo";
import type { Venue } from "../src/types";

const PROXIMITY_THRESHOLD_METERS = 80;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length < 3 || nb.length < 3) return na === nb;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

function findClusters(venues: Venue[]): Venue[][] {
  const clusters: Venue[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < venues.length; i++) {
    if (assigned.has(venues[i].id)) continue;
    const cluster = [venues[i]];
    for (let j = i + 1; j < venues.length; j++) {
      if (assigned.has(venues[j].id)) continue;
      const dist = haversineDistanceMeters(
        { lat: venues[i].latitude, lng: venues[i].longitude },
        { lat: venues[j].latitude, lng: venues[j].longitude }
      );
      if (dist <= PROXIMITY_THRESHOLD_METERS && namesLikelyMatch(venues[i].name, venues[j].name)) {
        cluster.push(venues[j]);
        assigned.add(venues[j].id);
      }
    }
    if (cluster.length > 1) {
      cluster.forEach((v) => assigned.add(v.id));
      clusters.push(cluster);
    }
  }
  return clusters;
}

function hasRealHours(v: Venue): boolean {
  return v.hours.some((h) => h.source === "ADMIN" || h.source === "VENUE_OWNER");
}

function hasRealAddress(v: Venue): boolean {
  return /^\d/.test(v.streetAddress.trim());
}

/** Lower is better — the venue to KEEP sorts first. */
function keeperRank(v: Venue): [number, number, number] {
  return [hasRealHours(v) ? 0 : 1, hasRealAddress(v) ? 0 : 1, new Date(v.createdAt).getTime()];
}

function compareRank(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

async function main() {
  const venues = await listAllVenuesForAdmin();
  const clusters = findClusters(venues);

  console.log(`${venues.length} total venues. Found ${clusters.length} likely-duplicate clusters.\n`);

  let deleted = 0;
  let skipped = 0;

  for (const cluster of clusters) {
    const anyRealAddress = cluster.some(hasRealAddress);
    console.log(`--- ${cluster.map((v) => v.name).join(" / ")} ---`);

    if (!anyRealAddress) {
      console.log(`  SKIPPED — no member has a real street address, not confident enough to auto-resolve.`);
      for (const v of cluster) console.log(`    [${v.id.slice(0, 8)}] "${v.name}" | ${v.streetAddress}, ${v.city}`);
      skipped++;
      console.log();
      continue;
    }

    const sorted = [...cluster].sort((a, b) => compareRank(keeperRank(a), keeperRank(b)));
    const [keeper, ...losers] = sorted;
    console.log(`  KEEP   [${keeper.id.slice(0, 8)}] "${keeper.name}" | ${keeper.streetAddress}, ${keeper.city}`);
    for (const loser of losers) {
      const { error } = await supabaseAdmin().from("venues").delete().eq("id", loser.id);
      if (error) throw new Error(`Deleting ${loser.name} (${loser.id}) failed: ${error.message}`);
      console.log(`  DELETE [${loser.id.slice(0, 8)}] "${loser.name}" | ${loser.streetAddress}, ${loser.city}`);
      deleted++;
    }
    console.log();
  }

  console.log(`Done. ${deleted} duplicate venues deleted, ${skipped} clusters skipped for manual review.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
