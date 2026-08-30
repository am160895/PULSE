/**
 * One-time tag: marks every venue from the Irish bars batch (scripts/addIrishBarsBatch.ts)
 * with subcategory "IRISH" — the map now colors Irish pubs orange (see
 * src/lib/venues/markerColor.ts), and that needs a real, queryable field rather than
 * matching on venue name at render time.
 *
 * Run with: npm run tag:irish
 */
import { listAllVenuesForAdmin, updateVenueAdmin } from "../src/lib/data/repository";
import { VENUES } from "./addIrishBarsBatch";

async function main() {
  const irishNames = new Set(VENUES.map((v) => v.name));
  const existing = await listAllVenuesForAdmin();

  let tagged = 0;
  let alreadyTagged = 0;
  let notFound = 0;

  for (const name of irishNames) {
    const venue = existing.find((v) => v.name === name);
    if (!venue) {
      console.log(`Not found (skipped): ${name}`);
      notFound++;
      continue;
    }
    if (venue.subcategory === "IRISH") {
      alreadyTagged++;
      continue;
    }
    await updateVenueAdmin(venue.id, { subcategory: "IRISH" });
    console.log(`Tagged: ${name}`);
    tagged++;
  }

  console.log(`\nDone. ${tagged} tagged, ${alreadyTagged} already tagged, ${notFound} not found.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
