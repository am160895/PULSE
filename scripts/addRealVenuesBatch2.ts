/**
 * One-time script: adds a curated batch of real, currently-operating Manhattan bars
 * (user-supplied name/neighborhood/address list, spot-verified via web search) as real
 * Venue rows — same honest pattern as addRealVenues.ts (no fabricated baseline/report
 * data, so these correctly compute as DIRECTORY coverage until real activity exists).
 *
 * Coordinates are resolved via Nominatim (OpenStreetMap's geocoder) rather than hand-typed
 * — free, no API key, rate-limited to 1 req/sec and requires an identifying User-Agent per
 * their usage policy (https://operations.osmfoundation.org/policies/nominatim/).
 *
 * Hours are deliberately left unset here. An OSM Overpass `opening_hours` lookup was tried
 * against this same batch first and came back empty for all ~26 venues attempted before it
 * was cut — real-world OSM tagging coverage for NYC bars isn't there yet, so the extra
 * round-trip bought nothing. Hours can be filled in by hand via the admin panel, or added
 * later if a better free source turns up — never guessed.
 *
 * This is a one-time snapshot, not a recurring sync — re-run manually to refresh (it's
 * idempotent, dedupes on name+address); there's no cron/scheduled job wired up.
 *
 * Run with: npm run seed:real2
 */
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueInput } from "../src/lib/data/repository";
import type { VenueType } from "../src/types";

const TIMEZONE = "America/New_York";
const NOMINATIM_USER_AGENT = "PULSE-nightlife-app/1.0 (one-time venue import script)";

interface SourceVenue {
  name: string;
  neighborhood: string;
  address: string; // full "street, city, state zip"
  venueType: VenueType;
  seedLatLng?: { lat: number; lng: number }; // pre-verified coordinates from the source list, used as-is
}

// Employees Only, Temple Bar, Attaboy, and Superbueno already exist from the first real-venue
// batch (addRealVenues.ts) — omitted here; the (name, address) dedupe check below would catch
// them anyway, but there's no reason to geocode venues we already know we'll skip.
const VENUES: SourceVenue[] = [
  { name: "Sip & Guzzle", neighborhood: "West Village", address: "29 Cornelia St, New York, NY 10014", venueType: "BAR" },
  { name: "Dante NYC", neighborhood: "Greenwich Village", address: "79-81 MacDougal St, New York, NY 10012", venueType: "BAR", seedLatLng: { lat: 40.7288036, lng: -74.0017068 } },
  { name: "Little Branch", neighborhood: "West Village", address: "20 7th Ave S, New York, NY 10014", venueType: "BAR" },
  { name: "Bar Pisellino", neighborhood: "West Village", address: "52 Grove St, New York, NY 10014", venueType: "BAR" },
  { name: "Katana Kitten (Batch 2 dup-check)", neighborhood: "West Village", address: "531 Hudson St, New York, NY 10014", venueType: "BAR" }, // already added in batch 1 under plain "Katana Kitten"; kept only so the dedupe log is explicit, will be skipped
  { name: "Analogue", neighborhood: "Greenwich Village", address: "19 W 8th St, New York, NY 10011", venueType: "LOUNGE" },
  { name: "Angel's Share", neighborhood: "West Village", address: "45 Grove St, New York, NY 10014", venueType: "BAR" },
  { name: "The Up & Up", neighborhood: "Greenwich Village", address: "116 MacDougal St, New York, NY 10012", venueType: "BAR" },
  { name: "Wilfie & Nell", neighborhood: "West Village", address: "228 W 4th St, New York, NY 10014", venueType: "BAR" },
  { name: "Mace", neighborhood: "Greenwich Village", address: "35 W 8th St, New York, NY 10011", venueType: "BAR", seedLatLng: { lat: 40.7331003, lng: -73.9980832 } },
  { name: "The Spaniard", neighborhood: "West Village", address: "190 W 4th St, New York, NY 10014", venueType: "BAR" },
  { name: "Fairfax", neighborhood: "West Village", address: "234 W 4th St, New York, NY 10014", venueType: "BAR" },
  { name: "Jac's on Bond", neighborhood: "NoHo", address: "26 Bond St, New York, NY 10012", venueType: "BAR" },
  { name: "The Crosby Bar", neighborhood: "SoHo", address: "79 Crosby St, New York, NY 10012", venueType: "LOUNGE" },
  { name: "JIMMY", neighborhood: "SoHo", address: "15 Thompson St, New York, NY 10013", venueType: "ROOFTOP" },
  { name: "The Roxy Bar", neighborhood: "Tribeca", address: "2 6th Ave, New York, NY 10013", venueType: "LOUNGE" },
  { name: "Saint Tuesday", neighborhood: "Tribeca", address: "77 Walker St, New York, NY 10013", venueType: "BAR" },
  { name: "Brandy Library", neighborhood: "Tribeca", address: "25 N Moore St, New York, NY 10013", venueType: "LOUNGE" },
  { name: "Smith & Mills", neighborhood: "Tribeca", address: "71 N Moore St, New York, NY 10013", venueType: "BAR" },
  { name: "Double Chicken Please", neighborhood: "Lower East Side", address: "115 Allen St, New York, NY 10002", venueType: "BAR" },
  { name: "Bar Snack", neighborhood: "East Village", address: "92 2nd Ave, New York, NY 10003", venueType: "BAR" },
  { name: "Death & Co", neighborhood: "East Village", address: "433 E 6th St, New York, NY 10009", venueType: "BAR" },
  { name: "Amor y Amargo", neighborhood: "East Village", address: "95 Avenue A, New York, NY 10009", venueType: "BAR" },
  { name: "Martiny's", neighborhood: "Gramercy", address: "121 E 17th St, New York, NY 10003", venueType: "BAR" },
  { name: "Dear Irving Gramercy", neighborhood: "Gramercy", address: "55 Irving Pl, New York, NY 10003", venueType: "LOUNGE" },
  { name: "Raines Law Room Chelsea", neighborhood: "Chelsea", address: "48 W 17th St, New York, NY 10011", venueType: "LOUNGE" },
  { name: "Patent Pending", neighborhood: "NoMad", address: "49 W 27th St, New York, NY 10001", venueType: "BAR", seedLatLng: { lat: 40.7453316, lng: -73.990223 } },
  { name: "The Portrait Bar", neighborhood: "NoMad", address: "1 W 28th St, New York, NY 10001", venueType: "LOUNGE" },
  { name: "Nubeluz", neighborhood: "NoMad", address: "25 W 28th St, New York, NY 10001", venueType: "ROOFTOP" },
  { name: "Oscar Wilde", neighborhood: "NoMad", address: "45 W 27th St, New York, NY 10001", venueType: "BAR" },
  { name: "Jungle Bird", neighborhood: "Chelsea", address: "174 8th Ave, New York, NY 10011", venueType: "BAR", seedLatLng: { lat: 40.7426241, lng: -74.0002294 } },
  { name: "Bathtub Gin", neighborhood: "Chelsea", address: "132 9th Ave, New York, NY 10011", venueType: "BAR" },
  { name: "The Fleur Room", neighborhood: "Chelsea", address: "105 W 28th St, New York, NY 10001", venueType: "ROOFTOP" },
  { name: "Somewhere Nowhere NYC", neighborhood: "Chelsea", address: "112 W 25th St, New York, NY 10001", venueType: "ROOFTOP" },
  { name: "The Campbell", neighborhood: "Midtown East", address: "15 Vanderbilt Ave, New York, NY 10017", venueType: "LOUNGE" },
  { name: "Dear Irving on Hudson", neighborhood: "Midtown West", address: "310 W 40th St, New York, NY 10018", venueType: "ROOFTOP" },
  { name: "Madame George", neighborhood: "Midtown", address: "45 W 45th St, New York, NY 10036", venueType: "BAR" },
  { name: "Pebble Bar", neighborhood: "Rockefeller Center", address: "67 W 49th St, New York, NY 10112", venueType: "BAR" },
  { name: "Ophelia Lounge", neighborhood: "Midtown East", address: "3 Mitchell Pl, New York, NY 10017", venueType: "ROOFTOP" },
  { name: "Albert's Bar", neighborhood: "Midtown East", address: "140 E 41st St, New York, NY 10017", venueType: "BAR" },
  { name: "Raines Law Room at The William", neighborhood: "Midtown East", address: "24 E 39th St, New York, NY 10016", venueType: "LOUNGE" },
  { name: "Overstory", neighborhood: "Financial District", address: "70 Pine St, New York, NY 10005", venueType: "ROOFTOP" },
  { name: "Manhatta", neighborhood: "Financial District", address: "28 Liberty St, New York, NY 10005", venueType: "ROOFTOP" },
  { name: "The Dead Rabbit", neighborhood: "Financial District", address: "30 Water St, New York, NY 10004", venueType: "BAR" },
  { name: "The Bar at Baccarat Hotel", neighborhood: "Midtown", address: "28 W 53rd St, New York, NY 10019", venueType: "LOUNGE" },
];

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
  } catch {
    return null; // transient network failure — treated the same as "couldn't geocode this one"
  }
  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const existing = await listAllVenuesForAdmin();
  const existingKey = new Set(existing.map((v) => `${v.name}|${v.streetAddress}`));

  let created = 0;
  let skipped = 0;
  let noCoords = 0;

  for (const v of VENUES) {
    if (v.name.includes("(Batch 2 dup-check)")) {
      console.log(`Skipping (already added in batch 1): ${v.name}`);
      skipped++;
      continue;
    }

    const streetAddress = v.address.split(",")[0].trim();
    if (existingKey.has(`${v.name}|${streetAddress}`)) {
      console.log(`Skipping (already exists): ${v.name}`);
      skipped++;
      continue;
    }

    let coords: { lat: number; lng: number } | null = v.seedLatLng ?? null;
    if (!coords) {
      await sleep(1100); // Nominatim policy: max 1 request/second
      coords = await geocode(v.address);
    }

    if (!coords) {
      console.log(`Skipping (could not geocode): ${v.name} — ${v.address}`);
      noCoords++;
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
