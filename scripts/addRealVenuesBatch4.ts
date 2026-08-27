/**
 * Fourth real-venue batch (SoHo/Nolita/Tribeca/Chelsea/Meatpacking/NoMad gaps) — same
 * honest pattern as the earlier batches: no fabricated activity data, coordinates
 * resolved via free Nominatim geocoding only, candidates spot-verified before inclusion.
 *
 * Run with: npm run seed:real4
 */
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueInput } from "../src/lib/data/repository";
import type { VenueType } from "../src/types";
import { geocode } from "../src/lib/geo/nominatim";

const TIMEZONE = "America/New_York";

interface SourceVenue {
  name: string;
  neighborhood: string;
  address: string;
  venueType: VenueType;
}

const VENUES: SourceVenue[] = [
  { name: "Titsou Bar", neighborhood: "Tribeca", address: "456 Greenwich St, New York, NY 10013", venueType: "BAR" },
  { name: "Mother's Ruin", neighborhood: "Nolita", address: "Mother's Ruin, 18 Spring St, New York, NY 10012", venueType: "BAR" },
  { name: "Paul's Casablanca", neighborhood: "Nolita", address: "Paul's Casablanca, 305 Spring St, New York, NY 10013", venueType: "CLUB" },
  { name: "Beyond The Pale", neighborhood: "Nolita", address: "Beyond The Pale, Nolita, New York, NY", venueType: "BAR" },
  { name: "Pearl Box", neighborhood: "SoHo", address: "Pearl Box, SoHo, New York, NY", venueType: "BAR" },
  { name: "Le Bain", neighborhood: "Meatpacking District", address: "Le Bain, 444 W 13th St, New York, NY 10014", venueType: "CLUB" },
  { name: "The Standard Biergarten", neighborhood: "Meatpacking District", address: "The Standard Biergarten, 848 Washington St, New York, NY 10014", venueType: "BAR" },
  { name: "The Electric Room", neighborhood: "Meatpacking District", address: "The Electric Room, 848 Washington St, New York, NY 10014", venueType: "CLUB" },
  { name: "Lobby Bar at Hotel Chelsea", neighborhood: "Chelsea", address: "Hotel Chelsea, 222 W 23rd St, New York, NY 10011", venueType: "LOUNGE" },
  { name: "The Ivory Peacock", neighborhood: "Chelsea", address: "The Ivory Peacock, Chelsea, New York, NY", venueType: "LOUNGE" },
  { name: "230 Fifth Rooftop Bar", neighborhood: "NoMad", address: "230 Fifth Ave, New York, NY 10001", venueType: "ROOFTOP" },
  { name: "The Nines", neighborhood: "East Village", address: "The Nines, East Village, New York, NY", venueType: "BAR" },
  { name: "Hi-Note", neighborhood: "East Village", address: "Hi-Note, East Village, New York, NY", venueType: "LIVE_MUSIC" },
  { name: "Paradise Lost", neighborhood: "East Village", address: "Paradise Lost, East Village, New York, NY", venueType: "BAR" },
  { name: "Lovers of Today", neighborhood: "East Village", address: "Lovers of Today, East Village, New York, NY", venueType: "BAR" },
  { name: "Mister Paradise", neighborhood: "East Village", address: "Mister Paradise, East Village, New York, NY", venueType: "BAR" },
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const existing = await listAllVenuesForAdmin();
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

    await sleep(1100);
    const coords = await geocode(v.address);
    if (!coords) {
      console.log(`Skipping (could not geocode): ${v.name} — ${v.address}`);
      noCoords++;
      continue;
    }

    const streetAddress = v.address.includes(",") ? v.address.split(",")[0].trim() : v.address;
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
