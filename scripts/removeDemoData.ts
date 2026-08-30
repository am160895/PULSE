/**
 * Precisely removes the ORIGINAL scripts/seed.ts demo dataset from the live database,
 * without touching any of the real venues added since (batch imports, admin-entered
 * venues, owner-claimed venues). "Precisely" matters here: this does NOT pattern-match on
 * vibes like "sounds fake" — it matches the exact, closed set of names seed.ts is
 * hard-coded to generate (its NAME_POOLS record, reproduced verbatim below) plus its
 * "No. NN" fallback-collision suffix and its five hand-placed "(Demo)" showcase venues.
 * Anything not an exact match to one of those is left alone.
 *
 * Deletes:
 *   - Every venue matching the above (cascades venue_hours/reports/snapshots/etc. via the
 *     schema's existing ON DELETE CASCADE — see supabase/migrations/0001_init.sql).
 *   - The six synthetic "reporter pool" accounts (james/conor/maria/priya/liam/ava@pulse.app)
 *     — always fake, never a real user.
 *   - demo@pulse.app (Jordan Rivera) itself — safe now that a real account has been
 *     promoted to ADMIN first (confirmed explicitly by the user, not assumed by this script).
 *
 * Run with: npm run cleanup:demo
 */
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { VenueType } from "../src/types";

// Verbatim copy of scripts/seed.ts's NAME_POOLS — the exact, closed set of names its
// background-venue generator can ever produce.
const NAME_POOLS: Record<VenueType, string[]> = {
  CLUB: ["Velvet Room", "Nightfall", "Mirage", "The Hideout", "Neon Dust", "Static", "Afterglow", "The Vault", "Moonlight Social", "Interlude", "Paradiso", "Low Frequency", "The Signal", "Echo Chamber", "Nocturne", "Aurora Room", "Habitat", "Circuit", "The Basement Room", "Sundown Club"],
  BAR: ["Corner Pocket", "The Lantern", "Ironwood", "Salt & Ash", "The Wren", "Backdoor", "Public Records Bar", "Slow Fox", "The Tinderbox", "Nightjar", "The Merchant", "Copper & Rye", "The Hideaway", "Wax & Wane", "The Alibi", "Low Tide", "Northbound", "The Quiet Man", "Hidden Hand", "The Junction", "Barkeep", "The Fifth Line"],
  LOUNGE: ["The Parlor", "Velour", "Amber Room", "The Study", "Nightshade Lounge", "The Green Room", "Halcyon", "The Sundry", "Ember Lounge", "The Salon", "Bluebird Lounge", "The Reserve", "Twilight Room", "The Annex", "Petal & Smoke"],
  ROOFTOP: ["Skyline Room", "The Perch", "Altitude", "The Terrace Club", "Highline Social", "Cloud Nine", "The Ledge", "Panorama Room", "Sundeck", "The Rooftop Room"],
  RESTAURANT: ["Osteria Nine", "Marchetti's", "The Fig Tree", "Bellina", "Cara Mia", "Little Field", "Corvo", "The Copper Pot", "Sable", "Marrow", "Petit Chou", "The Hearth", "Amaro Kitchen", "The Farmhouse Table", "Trattoria Sera"],
  LIVE_MUSIC: ["The Broken String", "Blue Room Live", "The Foghorn", "Static Hall", "The Roadhouse", "Echo & Reverb", "The Speakeasy Stage", "Lo-Fi Room", "The Cellar Stage", "Backline"],
  CAFE: ["Third Wave", "The Daily Grind Co", "Bloom Coffee", "Steep", "The Nook Cafe", "Moth & Bean", "Corner Table Coffee", "The Roastery", "Pressed", "Morning Line"],
  EVENT_SPACE: ["The Foundry", "Loft 512", "The Assembly Room", "Studio East", "The Warehouse Room"],
  OTHER: ["The Commons", "Civic Room", "The Yard"],
};
const POOL_NAME_SET = new Set(Object.values(NAME_POOLS).flat());

const SHOWCASE_DEMO_NAMES = new Set(["Little Sister (Demo)", "Dante (Demo)", "Night Owl (Demo)", "Room 57 (Demo)", "The Roof (Demo)"]);

const FAKE_REPORTER_EMAILS = ["james@pulse.app", "conor@pulse.app", "maria@pulse.app", "priya@pulse.app", "liam@pulse.app", "ava@pulse.app"];
const DEMO_ADMIN_EMAIL = "demo@pulse.app";

function isSeedGeneratedName(name: string): boolean {
  if (SHOWCASE_DEMO_NAMES.has(name)) return true;
  if (POOL_NAME_SET.has(name)) return true;
  // pickName()'s collision fallback: "<pool entry> No. <10-99>"
  const match = name.match(/^(.+) No\. \d{2}$/);
  return !!match && POOL_NAME_SET.has(match[1]);
}

async function main() {
  const venues = await listAllVenuesForAdmin();
  const demoVenues = venues.filter((v) => isSeedGeneratedName(v.name));

  console.log(`Found ${demoVenues.length} seed-generated venues out of ${venues.length} total:`);
  for (const v of demoVenues) console.log(`  - ${v.name} (${v.neighborhood})`);

  if (demoVenues.length > 0) {
    const { error } = await supabaseAdmin()
      .from("venues")
      .delete()
      .in("id", demoVenues.map((v) => v.id));
    if (error) throw new Error(`Deleting demo venues failed: ${error.message}`);
    console.log(`Deleted ${demoVenues.length} demo venues.`);
  }

  const { data: authUsers, error: listErr } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const emailsToDelete = new Set([...FAKE_REPORTER_EMAILS, DEMO_ADMIN_EMAIL]);
  let deletedUsers = 0;
  for (const u of authUsers.users) {
    if (u.email && emailsToDelete.has(u.email)) {
      const { error: delErr } = await supabaseAdmin().auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
      console.log(`Deleted account: ${u.email}`);
      deletedUsers++;
    }
  }

  console.log(`\nDone. ${demoVenues.length} demo venues removed, ${deletedUsers} demo/fake accounts removed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
