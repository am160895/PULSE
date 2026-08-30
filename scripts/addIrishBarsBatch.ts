/**
 * Irish bars batch — NYC (Manhattan/Brooklyn/Queens/Bronx/Staten Island) + Hoboken/Jersey
 * City, NJ. Bars only (venueType "BAR" throughout, no restaurants/lounges/clubs mixed in).
 *
 * Hours are hand-transcribed from the user's own research into real currently-listed
 * hours, not fabricated — every day left out of a venue's `hours` array is a day whose
 * hours the source explicitly couldn't confirm ("hours to verify," "erroneous," no hours
 * given at all), left for later admin review rather than guessed. Where a schedule spans
 * multiple days with one open time and a later day only gave a different close time, the
 * open time was carried forward from the last stated value — an inference, not a
 * fabrication, since every one of those source rows explicitly continued the same
 * day-range without restating the open time.
 *
 * Same honest pattern as the earlier real-venue batches: coordinates resolved via free
 * Nominatim geocoding only, source: "ADMIN" (createVenueAdmin's default) plus a fresh
 * verification timestamp, since this is genuinely hand-entered, sourced data.
 *
 * Run with: npm run seed:irish
 */
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueHoursInput, NewVenueInput } from "../src/lib/data/repository";
import { geocode } from "../src/lib/geo/nominatim";

const [SUN, MON, TUE, WED, THU, FRI, SAT] = [0, 1, 2, 3, 4, 5, 6];

function days(dayList: number[], openTime: string, closeTime: string): NewVenueHoursInput[] {
  return dayList.map((dayOfWeek) => ({ dayOfWeek, openTime, closeTime, isClosed: false }));
}
function daily(openTime: string, closeTime: string): NewVenueHoursInput[] {
  return days([SUN, MON, TUE, WED, THU, FRI, SAT], openTime, closeTime);
}

interface SourceVenue {
  name: string;
  neighborhood: string;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  hours: NewVenueHoursInput[];
}

const VENUES: SourceVenue[] = [
  {
    name: "The Blasket",
    neighborhood: "Midtown East",
    address: "1085 2nd Ave, New York, NY 10022",
    streetAddress: "1085 2nd Ave",
    city: "New York",
    state: "NY",
    postalCode: "10022",
    hours: [...days([MON, TUE, WED], "15:00", "01:00"), ...days([THU], "11:00", "01:00"), ...days([FRI, SAT], "11:00", "03:00"), ...days([SUN], "11:00", "01:00")],
  },
  {
    name: "McSorley's Old Ale House",
    neighborhood: "East Village",
    address: "15 E 7th St, New York, NY 10003",
    streetAddress: "15 E 7th St",
    city: "New York",
    state: "NY",
    postalCode: "10003",
    hours: [...days([MON, TUE, WED, THU, FRI, SAT], "11:00", "01:00"), ...days([SUN], "12:00", "01:00")],
  },
  {
    name: "The Dead Rabbit",
    neighborhood: "Financial District",
    address: "30 Water St, New York, NY 10004",
    streetAddress: "30 Water St",
    city: "New York",
    state: "NY",
    postalCode: "10004",
    hours: [...days([MON, TUE, WED, THU, SUN], "11:00", "02:00"), ...days([FRI, SAT], "11:00", "03:00")],
  },
  {
    name: "Molly's Shebeen",
    neighborhood: "Gramercy",
    address: "287 3rd Ave, New York, NY 10010",
    streetAddress: "287 3rd Ave",
    city: "New York",
    state: "NY",
    postalCode: "10010",
    hours: daily("11:00", "04:00"),
  },
  {
    name: "Paddy Reilly's Music Bar",
    neighborhood: "Kips Bay",
    address: "519 2nd Ave, New York, NY 10016",
    streetAddress: "519 2nd Ave",
    city: "New York",
    state: "NY",
    postalCode: "10016",
    hours: [...days([MON, TUE], "11:00", "02:00"), ...days([WED, THU, FRI, SAT], "11:00", "04:00"), ...days([SUN], "09:30", "02:00")],
  },
  {
    name: "Paddy Maguire's Ale House",
    neighborhood: "Gramercy",
    address: "237 3rd Ave, New York, NY 10003",
    streetAddress: "237 3rd Ave",
    city: "New York",
    state: "NY",
    postalCode: "10003",
    hours: daily("11:00", "04:00"),
  },
  {
    name: "Peter McManus Cafe",
    neighborhood: "Chelsea",
    address: "152 7th Ave, New York, NY 10011",
    streetAddress: "152 7th Ave",
    city: "New York",
    state: "NY",
    postalCode: "10011",
    hours: daily("12:00", "04:00"),
  },
  {
    name: "Maggie Reilly's",
    neighborhood: "Chelsea",
    address: "340 9th Ave, New York, NY 10001",
    streetAddress: "340 9th Ave",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    hours: daily("10:00", "04:00"),
  },
  {
    name: "Mulligan's",
    neighborhood: "Murray Hill",
    address: "267 Madison Ave, New York, NY 10016",
    streetAddress: "267 Madison Ave",
    city: "New York",
    state: "NY",
    postalCode: "",
    hours: [...days([MON], "11:00", "02:00"), ...days([TUE], "11:00", "03:00"), ...days([WED, THU, FRI, SAT], "11:00", "04:00"), ...days([SUN], "12:00", "02:00")],
  },
  {
    name: "Tír na Nóg",
    neighborhood: "Garment District",
    address: "254 W 31st St, New York, NY 10001",
    streetAddress: "254 W 31st St",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    hours: [...days([MON, TUE, WED], "11:00", "00:00"), ...days([THU, FRI], "11:00", "01:00"), ...days([SAT], "11:00", "00:00"), ...days([SUN], "11:00", "23:00")],
  },
  {
    name: "The Mean Fiddler",
    neighborhood: "Hell's Kitchen",
    address: "266 W 47th St, New York, NY 10036",
    streetAddress: "266 W 47th St",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    hours: [...days([MON, TUE], "12:00", "04:00"), ...days([WED, THU, FRI, SAT, SUN], "11:00", "04:00")],
  },
  {
    name: "Playwright Celtic Pub",
    neighborhood: "Hell's Kitchen",
    address: "732 8th Ave, New York, NY 10036",
    streetAddress: "732 8th Ave",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    hours: daily("10:00", "04:00"),
  },
  {
    name: "Gabby O'Hara's",
    neighborhood: "Garment District",
    address: "123 W 39th St, New York, NY 10018",
    streetAddress: "123 W 39th St",
    city: "New York",
    state: "NY",
    postalCode: "10018",
    hours: [...days([MON, TUE, WED, THU, FRI, SAT], "11:00", "04:00"), ...days([SUN], "12:00", "04:00")],
  },
  {
    name: "Gibney's NYC",
    neighborhood: "Garment District",
    address: "228 W 39th St, New York, NY 10018",
    streetAddress: "228 W 39th St",
    city: "New York",
    state: "NY",
    postalCode: "10018",
    hours: daily("12:00", "02:00"),
  },
  {
    name: "St. Pat's Bar & Grill",
    neighborhood: "Midtown",
    address: "22 W 46th St, New York, NY 10036",
    streetAddress: "22 W 46th St",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    hours: daily("11:00", "04:00"),
  },
  {
    name: "Hibernia Bar",
    neighborhood: "Hell's Kitchen",
    address: "401 W 50th St, New York, NY 10019",
    streetAddress: "401 W 50th St",
    city: "New York",
    state: "NY",
    postalCode: "10019",
    hours: [...days([MON, TUE, WED, THU], "16:00", "03:00"), ...days([FRI, SAT], "12:00", "04:00"), ...days([SUN], "12:00", "03:00")],
  },
  {
    name: "The Landmark Tavern",
    neighborhood: "Hell's Kitchen",
    address: "626 11th Ave, New York, NY 10036",
    streetAddress: "626 11th Ave",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    hours: daily("12:00", "00:00"),
  },
  {
    name: "Pig 'N' Whistle - 36th",
    neighborhood: "Garment District",
    address: "202 W 36th St, New York, NY 10018",
    streetAddress: "202 W 36th St",
    city: "New York",
    state: "NY",
    postalCode: "10018",
    hours: daily("11:30", "02:00"),
  },
  {
    name: "Pig 'N' Whistle - 48th",
    neighborhood: "Midtown",
    address: "58 W 48th St, New York, NY 10036",
    streetAddress: "58 W 48th St",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    // Mon-Sat listed only as "11am-late" — no confirmed close time, left for admin review.
    hours: days([SUN], "11:00", "23:00"),
  },
  {
    name: "Cassidy's Pub",
    neighborhood: "Midtown",
    address: "65 W 55th St, New York, NY 10019",
    streetAddress: "65 W 55th St",
    city: "New York",
    state: "NY",
    postalCode: "10019",
    hours: daily("11:00", "04:00"),
  },
  {
    name: "McGee's Pub",
    neighborhood: "Midtown",
    address: "240 W 55th St, New York, NY 10019",
    streetAddress: "240 W 55th St",
    city: "New York",
    state: "NY",
    postalCode: "10019",
    hours: daily("11:00", "02:00"),
  },
  {
    name: "The Dawson",
    neighborhood: "Midtown",
    address: "23 W 45th St, New York, NY 10036",
    streetAddress: "23 W 45th St",
    city: "New York",
    state: "NY",
    postalCode: "10036",
    hours: [...days([MON, TUE, WED, THU, FRI], "11:30", "01:00"), ...days([SAT], "11:00", "01:00"), ...days([SUN], "11:30", "23:00")],
  },
  {
    name: "Dawson 39",
    neighborhood: "Garment District",
    address: "54 W 39th St, New York, NY 10018",
    streetAddress: "54 W 39th St",
    city: "New York",
    state: "NY",
    postalCode: "10018",
    // Thu-Sun explicitly "require recheck" in the source — left for admin review.
    hours: [...days([MON], "15:00", "00:00"), ...days([TUE, WED], "12:00", "00:00")],
  },
  {
    name: "Sonny's",
    neighborhood: "Murray Hill",
    address: "16 E 41st St, New York, NY 10017",
    streetAddress: "16 E 41st St",
    city: "New York",
    state: "NY",
    postalCode: "10017",
    hours: [...days([MON, TUE, WED], "11:30", "00:00"), ...days([THU, FRI], "11:30", "02:00"), ...days([SAT], "12:00", "01:00"), ...days([SUN], "09:30", "23:00")],
  },
  {
    name: "Ryan's Daughter",
    neighborhood: "Yorkville",
    address: "350 E 85th St, New York, NY 10028",
    streetAddress: "350 E 85th St",
    city: "New York",
    state: "NY",
    postalCode: "10028",
    hours: [...days([MON, TUE, WED, THU, FRI], "12:00", "04:00"), ...days([SAT, SUN], "11:00", "04:00")],
  },
  {
    name: "Finnegan's Wake",
    neighborhood: "Upper East Side",
    address: "1361 1st Ave, New York, NY 10021",
    streetAddress: "1361 1st Ave",
    city: "New York",
    state: "NY",
    postalCode: "10021",
    // Source flags the venue's own listed hours as erroneous — nothing usable to enter.
    hours: [],
  },
  {
    name: "O'Hara's Restaurant & Pub",
    neighborhood: "Financial District",
    address: "120 Cedar St, New York, NY 10006",
    streetAddress: "120 Cedar St",
    city: "New York",
    state: "NY",
    postalCode: "10006",
    hours: [...days([MON, TUE, WED, THU, FRI, SAT], "11:00", "00:00"), ...days([SUN], "12:00", "00:00")],
  },
  {
    name: "McMahon's Public House",
    neighborhood: "Park Slope",
    address: "39 5th Ave, Brooklyn, NY 11217",
    streetAddress: "39 5th Ave",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11217",
    hours: [...days([MON], "11:00", "03:00"), ...days([TUE, WED, THU, FRI], "11:00", "02:00"), ...days([SAT], "10:00", "02:00"), ...days([SUN], "11:00", "02:00")],
  },
  {
    name: "The Clonard",
    neighborhood: "Williamsburg",
    address: "506 Grand St, Brooklyn, NY 11211",
    streetAddress: "506 Grand St",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11211",
    hours: [...days([MON, TUE, WED], "16:00", "00:00"), ...days([THU], "16:00", "02:00"), ...days([FRI], "12:00", "03:00"), ...days([SAT], "10:00", "03:00"), ...days([SUN], "10:00", "00:00")],
  },
  {
    name: "Donovan's Pub",
    neighborhood: "Woodside",
    address: "57-24 Roosevelt Ave, Woodside, NY 11377",
    streetAddress: "57-24 Roosevelt Ave",
    city: "Woodside",
    state: "NY",
    postalCode: "11377",
    hours: [...days([MON, TUE, WED, THU], "11:00", "23:00"), ...days([FRI, SAT], "11:00", "02:00"), ...days([SUN], "11:00", "00:00")],
  },
  {
    name: "Bantry Bay Publick House",
    neighborhood: "Long Island City",
    address: "33-01 Greenpoint Ave, Long Island City, NY 11101",
    streetAddress: "33-01 Greenpoint Ave",
    city: "Long Island City",
    state: "NY",
    postalCode: "11101",
    hours: [...days([MON, TUE, WED, THU, FRI], "11:00", "02:00"), ...days([SAT, SUN], "12:00", "01:00")],
  },
  {
    name: "Maggie Mae's",
    neighborhood: "Sunnyside",
    address: "41-15 Queens Blvd, Sunnyside, NY 11104",
    streetAddress: "41-15 Queens Blvd",
    city: "Sunnyside",
    state: "NY",
    postalCode: "11104",
    // Source only gave a rough close time ("mostly until 4am daily") with no open time at all.
    hours: [],
  },
  {
    name: "Rambling House",
    neighborhood: "Woodlawn",
    address: "4292 Katonah Ave, Bronx, NY 10470",
    streetAddress: "4292 Katonah Ave",
    city: "Bronx",
    state: "NY",
    postalCode: "10470",
    hours: [...days([SUN, MON, TUE, WED, THU], "11:00", "02:00"), ...days([FRI, SAT], "11:00", "04:00")],
  },
  {
    name: "O'Neill's",
    neighborhood: "Staten Island",
    address: "1614 Forest Ave, Staten Island, NY 10302",
    streetAddress: "1614 Forest Ave",
    city: "Staten Island",
    state: "NY",
    postalCode: "10302",
    hours: [...days([SUN, MON, TUE, WED, THU], "11:00", "22:00"), ...days([FRI, SAT], "11:00", "00:00")],
  },
  {
    name: "Finnegan's Pub",
    neighborhood: "Hoboken",
    address: "734 Willow Ave, Hoboken, NJ 07030",
    streetAddress: "734 Willow Ave",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    // Monday not mentioned at all in the source — left out rather than assumed closed.
    hours: [...days([TUE, WED, THU], "15:30", "02:00"), ...days([FRI], "15:30", "03:00"), ...days([SAT], "12:00", "03:00"), ...days([SUN], "12:00", "01:00")],
  },
  {
    name: "Dagda Irish Prochóg",
    neighborhood: "Jersey City",
    address: "123 Newark Ave, Jersey City, NJ 07302",
    streetAddress: "123 Newark Ave",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07302",
    hours: [...days([MON, TUE, WED, THU, SUN], "13:00", "02:00"), ...days([FRI], "13:00", "03:00"), ...days([SAT], "13:00", "02:00")],
  },
  {
    name: "Dorrian's Red Hand",
    neighborhood: "Jersey City",
    address: "555 Washington Blvd, Jersey City, NJ 07310",
    streetAddress: "555 Washington Blvd",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07310",
    hours: [...days([MON], "15:00", "01:00"), ...days([TUE, WED, THU], "11:00", "02:00"), ...days([FRI, SAT], "11:00", "02:30"), ...days([SUN], "15:00", "01:00")],
  },
  {
    name: "New Park Tavern",
    neighborhood: "Jersey City",
    address: "575 West Side Ave, Jersey City, NJ 07304",
    streetAddress: "575 West Side Ave",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07304",
    hours: [...days([MON, TUE, WED, THU], "10:00", "02:00"), ...days([FRI, SAT], "10:00", "03:00"), ...days([SUN], "12:00", "02:00")],
  },
  {
    name: "San Patricios",
    neighborhood: "Jersey City",
    address: "8 Erie St, Jersey City, NJ 07302",
    streetAddress: "8 Erie St",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07302",
    hours: [...days([MON, TUE], "16:00", "00:00"), ...days([WED, THU], "16:00", "01:00"), ...days([FRI], "16:00", "02:00"), ...days([SAT], "11:00", "02:00"), ...days([SUN], "11:00", "00:00")],
  },
  {
    name: "Grace O'Malley's Whiskey Chapel",
    neighborhood: "Jersey City",
    address: "140 Newark Ave, Jersey City, NJ 07302",
    streetAddress: "140 Newark Ave",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07302",
    hours: [], // source: "hours need current verification"
  },
  {
    name: "Moran's Pub",
    neighborhood: "Hoboken",
    address: "501 Garden St, Hoboken, NJ 07030",
    streetAddress: "501 Garden St",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    hours: [], // source: "hours to verify"
  },
  {
    name: "The Ferryman",
    neighborhood: "Hoboken",
    address: "94 Bloomfield St, Hoboken, NJ 07030",
    streetAddress: "94 Bloomfield St",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    hours: [], // source: "hours to verify"
  },
  {
    name: "McSwiggan's Pub",
    neighborhood: "Hoboken",
    address: "110 1st St, Hoboken, NJ 07030",
    streetAddress: "110 1st St",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    hours: [], // source: "hours to verify"
  },
  {
    name: "The Shannon",
    neighborhood: "Hoboken",
    address: "106 1st St, Hoboken, NJ 07030",
    streetAddress: "106 1st St",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    hours: [], // no hours given in the source at all
  },
  {
    name: "Willie McBride's",
    neighborhood: "Hoboken",
    address: "616 Grand St, Hoboken, NJ 07030",
    streetAddress: "616 Grand St",
    city: "Hoboken",
    state: "NJ",
    postalCode: "07030",
    hours: [], // no hours given in the source at all
  },
  {
    name: "O'Hara's Downtown",
    neighborhood: "Jersey City",
    address: "172 1st St, Jersey City, NJ 07302",
    streetAddress: "172 1st St",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07302",
    hours: [], // no hours given in the source at all
  },
  {
    name: "O'Leary's Publik House",
    neighborhood: "Jersey City",
    address: "788 Garfield Ave, Jersey City, NJ 07304",
    streetAddress: "788 Garfield Ave",
    city: "Jersey City",
    state: "NJ",
    postalCode: "07304",
    hours: [], // no hours given in the source at all
  },
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

    await sleep(1100); // Nominatim's 1 req/sec policy
    const coords = await geocode(v.address);
    if (!coords) {
      console.log(`Skipping (could not geocode): ${v.name} — ${v.address}`);
      noCoords++;
      continue;
    }

    const input: NewVenueInput = {
      name: v.name,
      category: "Nightlife",
      subcategory: null,
      venueType: "BAR",
      neighborhood: v.neighborhood,
      streetAddress: v.streetAddress,
      city: v.city,
      state: v.state,
      postalCode: v.postalCode,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone: "America/New_York",
      website: null,
      instagramHandle: null,
      capacityEstimate: null,
      priceLevel: 2,
      musicType: null,
      isActive: true,
      hours: v.hours,
    };

    await createVenueAdmin(input);
    console.log(`Added: ${v.name} (${v.neighborhood}) — ${v.hours.length} hours rows`);
    created++;
  }

  console.log(`\nDone. ${created} added, ${skipped} skipped (duplicates), ${noCoords} skipped (geocode failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
