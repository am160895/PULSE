/**
 * 351-venue NYC/NJ directory import, from a user-supplied CSV
 * (pulse_nyc_nj_500_venue_directory.csv). The source file actually had 500 rows, but 149
 * were literal placeholder rows the file itself labeled "Unverified venue slot" / address
 * "VERIFY" / note "Placeholder — replace with verified real venue before import" — those
 * are excluded entirely (never imported), not just deprioritized; scripts/data/
 * venueDirectory351.json holds only the other 351, pre-cleaned via a one-off Python pass
 * (csv.DictReader — the file's quoted-comma addresses aren't safely splittable by hand).
 *
 * Of those 351, only 18 had actual structured hours in the source (the "Weekly Hours"
 * column literally said "VERIFY" for the other 333) — those 18 are hand-transcribed below,
 * hand-verified against the source string in scripts/data/venueDirectory351.json's
 * "weeklyHours" field for each. Everywhere the source didn't state a day's hours (or said
 * "Late"), that day is left out rather than guessed — same honest-data convention as
 * addIrishBarsBatch.ts.
 *
 * Run with: npm run seed:directory
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueHoursInput, NewVenueInput } from "../src/lib/data/repository";
import type { VenueType } from "../src/types";
import { geocode } from "../src/lib/geo/nominatim";

const [SUN, MON, TUE, WED, THU, FRI, SAT] = [0, 1, 2, 3, 4, 5, 6];

function days(dayList: number[], openTime: string, closeTime: string): NewVenueHoursInput[] {
  return dayList.map((dayOfWeek) => ({ dayOfWeek, openTime, closeTime, isClosed: false }));
}
function daily(openTime: string, closeTime: string): NewVenueHoursInput[] {
  return days([SUN, MON, TUE, WED, THU, FRI, SAT], openTime, closeTime);
}
function closedDays(dayList: number[]): NewVenueHoursInput[] {
  return dayList.map((dayOfWeek) => ({ dayOfWeek, isClosed: true, openTime: null, closeTime: null }));
}

const STRUCTURED_HOURS: Record<string, NewVenueHoursInput[]> = {
  "The Dead Rabbit": [...days([FRI, SAT], "11:00", "03:00"), ...days([SUN, MON, TUE, WED, THU], "11:00", "02:00")],
  "Swift Hibernian Lounge": daily("11:30", "04:00"),
  "Molly's Shebeen": daily("11:00", "04:00"),
  "The Landmark Tavern": daily("12:00", "00:00"),
  "Wolfe Tone's Pub & Kitchen": daily("11:00", "04:00"),
  "Tara Mor": [...days([MON, TUE, WED, THU, FRI], "12:00", "02:00"), ...days([SAT, SUN], "11:00", "02:00")],
  "Connolly's": [...days([MON, TUE, WED, THU, FRI, SAT], "08:00", "02:00"), ...days([SUN], "09:00", "02:00")],
  // Source: "Daily 5:00 PM-1:00 AM; Fri-Sat to 2:00 AM" — Fri/Sat keep the same 5pm open,
  // just close later; not a fabrication, the source explicitly phrased it as a delta.
  "The Archer": [...days([SUN, MON, TUE, WED, THU], "17:00", "01:00"), ...days([FRI, SAT], "17:00", "02:00")],
  "Under The Boot": days([FRI, SAT], "19:00", "03:00"),
  dullboy: [...days([TUE, WED], "16:00", "22:00"), ...days([THU, FRI, SAT], "11:30", "00:00"), ...days([SUN], "11:30", "22:00")],
  "The Ashford": [
    ...days([MON], "13:00", "02:00"),
    ...days([TUE, WED, THU], "16:00", "02:00"),
    ...days([FRI], "16:00", "03:00"),
    ...days([SAT], "11:30", "03:00"),
    ...days([SUN], "11:30", "02:00"),
  ],
  "Cellar 335": [...days([TUE, WED, THU], "17:00", "22:00"), ...days([FRI, SAT], "17:00", "23:00")],
  "Zeppelin Hall Beer Garden": [
    ...days([MON, TUE, WED], "16:00", "01:30"),
    ...days([THU], "16:00", "01:45"),
    ...days([FRI], "16:00", "02:45"),
    ...days([SAT], "12:00", "02:45"),
    ...days([SUN], "12:00", "01:30"),
  ],
  "San Patricios": [
    ...days([MON, TUE], "16:00", "00:00"),
    ...days([WED, THU], "16:00", "01:00"),
    ...days([FRI], "16:00", "02:00"),
    ...days([SAT], "11:00", "02:00"),
    ...days([SUN], "11:00", "00:00"),
  ],
  "Low Fidelity": [...days([MON, TUE, WED, THU], "17:00", "02:00"), ...days([FRI], "17:00", "03:00"), ...days([SAT], "12:00", "03:00"), ...days([SUN], "12:00", "02:00")],
  "QXT's Night Club": [...days([WED, THU], "20:00", "01:00"), ...days([FRI, SAT], "22:00", "03:00"), ...days([SUN], "18:00", "00:00")],
  "BarCode Entertainment Complex": [...days([THU, FRI, SAT], "21:00", "03:00"), ...days([SUN], "12:00", "02:00")],
  // Source: "...Sun 12:00 PM-Late; Mon-Wed Closed" — "Late" isn't a real close time, so
  // Sunday is left out entirely rather than guessed; Mon-Wed's explicit "Closed" IS real
  // data though, encoded as isClosed rather than just omitted.
  "Tally Ho": [...days([THU], "16:00", "02:00"), ...days([FRI], "16:00", "03:00"), ...days([SAT], "14:00", "03:00"), ...closedDays([MON, TUE, WED])],
};

interface SourceRow {
  name: string;
  address: string;
  type: string;
  neighborhood: string;
  weeklyHours: string;
}

function mapVenueType(raw: string): VenueType {
  const t = raw.toLowerCase();
  if (t.includes("club")) return "CLUB";
  if (t.includes("rooftop")) return "ROOFTOP";
  if (t.includes("music")) return "LIVE_MUSIC";
  if (t.includes("lounge")) return "LOUNGE";
  return "BAR"; // pub, dive bar, speakeasy, tavern, cocktail/beer/wine/whiskey/cigar/sports/hotel/piano bar, beer garden/hall, brewery, etc.
}

function parseAddress(address: string): { streetAddress: string; city: string; state: string; postalCode: string } {
  const streetAddress = address.split(",")[0].trim();
  const match = address.match(/,\s*([A-Za-z .'-]+?),\s*([A-Za-z]{2})\s*(\d{5})?\s*$/);
  return {
    streetAddress,
    city: match ? match[1].trim() : "New York",
    state: match ? match[2].toUpperCase() : "NY",
    postalCode: match?.[3] ?? "",
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const raw = readFileSync(path.join(__dirname, "data", "venueDirectory351.json"), "utf-8");
  const rows: SourceRow[] = JSON.parse(raw);

  const existing = await listAllVenuesForAdmin();
  const existingNames = new Set(existing.map((v) => v.name));

  let created = 0;
  let skipped = 0;
  let noCoords = 0;

  for (const row of rows) {
    if (existingNames.has(row.name)) {
      console.log(`Skipping (name already exists): ${row.name}`);
      skipped++;
      continue;
    }

    await sleep(1100); // Nominatim's 1 req/sec policy
    const coords = await geocode(row.address);
    if (!coords) {
      console.log(`Skipping (could not geocode): ${row.name} — ${row.address}`);
      noCoords++;
      continue;
    }

    const { streetAddress, city, state, postalCode } = parseAddress(row.address);
    const hours = STRUCTURED_HOURS[row.name] ?? [];
    const neighborhood = row.neighborhood.split("/")[0].trim();

    const input: NewVenueInput = {
      name: row.name,
      category: "Nightlife",
      subcategory: null,
      venueType: mapVenueType(row.type),
      neighborhood,
      streetAddress,
      city,
      state,
      postalCode,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone: "America/New_York",
      website: null,
      instagramHandle: null,
      capacityEstimate: null,
      priceLevel: 2,
      musicType: null,
      isActive: true,
      hours,
    };

    await createVenueAdmin(input);
    console.log(`Added: ${row.name} (${neighborhood}) — ${hours.length} hours rows`);
    created++;
    existingNames.add(row.name);
  }

  console.log(`\nDone. ${created} added, ${skipped} skipped (duplicates), ${noCoords} skipped (geocode failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
