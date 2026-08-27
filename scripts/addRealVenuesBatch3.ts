/**
 * Third real-venue batch (West Village/Greenwich Village/LES/Chinatown/East Village
 * gaps) — same honest pattern as addRealVenues.ts/addRealVenuesBatch2.ts: no fabricated
 * baseline/report data, coordinates resolved via free Nominatim geocoding, never
 * hand-typed. Candidates spot-verified via WebSearch before inclusion (some names from
 * the source list — "South Soho Bar", "Reception Bar", "Bar Lula" — could not be
 * confirmed as real currently-operating venues and were dropped rather than inserted on
 * faith).
 *
 * Run with: npm run seed:real3
 */
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueInput } from "../src/lib/data/repository";
import type { VenueType } from "../src/types";
import { geocode } from "../src/lib/geo/nominatim";

const TIMEZONE = "America/New_York";

interface SourceVenue {
  name: string;
  neighborhood: string;
  /** Either a verified exact street address, or a "name, neighborhood, New York, NY"
   * search query for Nominatim to resolve by business name when no exact address was
   * confirmed — either way, coordinates are never hand-typed. */
  address: string;
  venueType: VenueType;
}

const VENUES: SourceVenue[] = [
  { name: "Le Dive", neighborhood: "West Village", address: "Le Dive, West Village, New York, NY", venueType: "BAR" },
  { name: "The Garret", neighborhood: "West Village", address: "The Garret, 296 Bleecker St, New York, NY 10014", venueType: "BAR" },
  { name: "The Duplex", neighborhood: "West Village", address: "The Duplex, 61 Christopher St, New York, NY 10014", venueType: "LIVE_MUSIC" },
  { name: "Marie's Crisis Cafe", neighborhood: "West Village", address: "Marie's Crisis Cafe, 59 Grove St, New York, NY 10014", venueType: "LIVE_MUSIC" },
  { name: "Bar Moga", neighborhood: "Greenwich Village", address: "Bar Moga, 6 Depeyster Pl, New York, NY 10012", venueType: "BAR" },
  { name: "Ray's (Lower East Side)", neighborhood: "Lower East Side", address: "Ray's, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "Lullaby", neighborhood: "Lower East Side", address: "Lullaby, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "The Flower Shop", neighborhood: "Lower East Side", address: "The Flower Shop, 107 Eldridge St, New York, NY 10002", venueType: "BAR" },
  { name: "Bar Belly", neighborhood: "Lower East Side", address: "Bar Belly, 14 Orchard St, New York, NY 10002", venueType: "BAR" },
  { name: "The Back Room", neighborhood: "Lower East Side", address: "The Back Room, 102 Norfolk St, New York, NY 10002", venueType: "BAR" },
  { name: "Loreley Beer Garden", neighborhood: "Lower East Side", address: "Loreley, 7 Rivington St, New York, NY 10002", venueType: "BAR" },
  { name: "Parcelle", neighborhood: "Lower East Side", address: "Parcelle, 179 Orchard St, New York, NY 10002", venueType: "BAR" },
  { name: "Bar Goto", neighborhood: "Lower East Side", address: "Bar Goto, 245 Eldridge St, New York, NY 10002", venueType: "BAR" },
  { name: "169 Bar", neighborhood: "Lower East Side", address: "169 Bar, 169 East Broadway, New York, NY 10002", venueType: "BAR" },
  { name: "Subject", neighborhood: "Lower East Side", address: "Subject, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "Tigre", neighborhood: "Lower East Side", address: "Tigre, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "The Ripple Room", neighborhood: "Lower East Side", address: "The Ripple Room, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "Forgtmenot", neighborhood: "Lower East Side", address: "138 Division St, New York, NY 10002", venueType: "BAR" },
  { name: "Parkside Lounge", neighborhood: "Lower East Side", address: "Parkside Lounge, 317 E Houston St, New York, NY 10002", venueType: "LIVE_MUSIC" },
  { name: "Mr. Purple", neighborhood: "Lower East Side", address: "Mr. Purple, 180 Orchard St, New York, NY 10002", venueType: "ROOFTOP" },
  { name: "Hotel Chantelle", neighborhood: "Lower East Side", address: "Hotel Chantelle, 92 Ludlow St, New York, NY 10002", venueType: "ROOFTOP" },
  { name: "Pianos", neighborhood: "Lower East Side", address: "Pianos, 158 Ludlow St, New York, NY 10002", venueType: "LIVE_MUSIC" },
  { name: "Kind Regards", neighborhood: "Lower East Side", address: "Kind Regards, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "Peachy's", neighborhood: "Lower East Side", address: "Peachy's, Lower East Side, New York, NY", venueType: "BAR" },
  { name: "Apotheke", neighborhood: "Chinatown", address: "Apotheke, 9 Doyers St, New York, NY 10013", venueType: "BAR" },
  { name: "Schmuck", neighborhood: "East Village", address: "Schmuck, East Village, New York, NY", venueType: "BAR" },
  { name: "Banshee", neighborhood: "East Village", address: "Banshee, East Village, New York, NY", venueType: "BAR" },
  { name: "Bar Kabawa", neighborhood: "East Village", address: "Bar Kabawa, East Village, New York, NY", venueType: "BAR" },
  { name: "Holiday Cocktail Lounge", neighborhood: "East Village", address: "Holiday Cocktail Lounge, 75 St Marks Pl, New York, NY 10003", venueType: "BAR" },
  { name: "Joyface", neighborhood: "East Village", address: "Joyface, East Village, New York, NY", venueType: "BAR" },
  { name: "Dream Baby", neighborhood: "East Village", address: "Dream Baby, East Village, New York, NY", venueType: "BAR" },
  { name: "The Wayland", neighborhood: "East Village", address: "The Wayland, 700 E 9th St, New York, NY 10009", venueType: "BAR" },
  { name: "Madeline's Martini", neighborhood: "East Village", address: "Madeline's Martini, East Village, New York, NY", venueType: "BAR" },
  { name: "Sauced (East Village)", neighborhood: "East Village", address: "47 2nd St, New York, NY 10003", venueType: "BAR" },
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const existing = await listAllVenuesForAdmin();
  const existingKey = new Set(existing.map((v) => `${v.name}|${v.streetAddress}`));
  const existingNames = new Set(existing.map((v) => v.name));

  let created = 0;
  let skipped = 0;
  let noCoords = 0;

  for (const v of VENUES) {
    if (existingNames.has(v.name)) {
      console.log(`Skipping (name already exists): ${v.name}`);
      skipped++;
      continue;
    }

    await sleep(1100); // Nominatim policy: max 1 request/second
    const coords = await geocode(v.address);
    if (!coords) {
      console.log(`Skipping (could not geocode): ${v.name} — ${v.address}`);
      noCoords++;
      continue;
    }

    const streetAddress = v.address.includes(",") ? v.address.split(",")[0].trim() : v.address;
    if (existingKey.has(`${v.name}|${streetAddress}`)) {
      console.log(`Skipping (already exists): ${v.name}`);
      skipped++;
      continue;
    }

    const zipMatch = v.address.match(/\b(\d{5})\b/);

    const input: NewVenueInput = {
      name: v.name,
      category: "Nightlife",
      subcategory: null,
      venueType: v.venueType,
      neighborhood: v.neighborhood,
      streetAddress,
      city: "New York",
      state: "NY",
      postalCode: zipMatch ? zipMatch[1] : "",
      latitude: coords.lat,
      longitude: coords.lng,
      timezone: TIMEZONE,
      website: null,
      instagramHandle: null,
      capacityEstimate: null,
      priceLevel: 2,
      musicType: null,
      isActive: true,
      hours: [],
    };

    await createVenueAdmin(input);
    console.log(`Added: ${v.name} (${v.neighborhood})`);
    created++;
  }

  console.log(`\nDone. ${created} added, ${skipped} skipped (duplicates), ${noCoords} skipped (geocode failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
