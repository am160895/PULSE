/**
 * One-time script: adds real, currently-operating NYC bars (verified via web search
 * 2026-08-25 — names, addresses, and hours are sourced from each venue's own site or
 * major listing sites, not fabricated) as real Venue rows.
 *
 * Deliberately does NOT generate baselines or reports for these — that's the whole point.
 * A venue with zero baseline data and zero reports correctly computes as DIRECTORY coverage
 * (see src/lib/venues/coverageState.ts) and shows "No live PULSE yet" rather than a
 * fabricated score for a real business. Coordinates are approximate (placed from the known
 * street/cross-street, not a geocoding API call) — accurate enough for a discovery map, not
 * claimed as survey-precise.
 *
 * Run with: npm run seed:real (see package.json)
 */
import { createVenueAdmin, listAllVenuesForAdmin } from "../src/lib/data/repository";
import type { NewVenueInput } from "../src/lib/data/repository";

type RealVenue = Omit<NewVenueInput, "category" | "isActive">;

const TIMEZONE = "America/New_York";

const VENUES: RealVenue[] = [
  {
    name: "Katana Kitten",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "West Village",
    streetAddress: "531 Hudson St",
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: 40.7333,
    longitude: -74.0067,
    timezone: TIMEZONE,
    website: "https://www.katanakitten.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 3,
    musicType: null,
    hours: [
      { dayOfWeek: 1, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 2, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 3, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 4, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 5, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 6, openTime: "14:00", closeTime: "02:00" },
      { dayOfWeek: 0, openTime: "14:00", closeTime: "00:00" },
    ],
  },
  {
    name: "Employees Only",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "West Village",
    streetAddress: "510 Hudson St",
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: 40.7326,
    longitude: -74.0064,
    timezone: TIMEZONE,
    website: "https://www.employeesonlynyc.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 3,
    musicType: null,
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "18:00", closeTime: "04:00" })),
  },
  {
    name: "Cubbyhole",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "West Village",
    streetAddress: "281 W 12th St",
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: 40.7377,
    longitude: -74.0027,
    timezone: TIMEZONE,
    website: "https://www.cubbyholebar.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 1,
    musicType: null,
    hours: [
      { dayOfWeek: 1, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 2, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 3, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 4, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 5, openTime: "16:00", closeTime: "04:00" },
      { dayOfWeek: 6, openTime: "14:00", closeTime: "04:00" },
      { dayOfWeek: 0, openTime: "14:00", closeTime: "02:00" },
    ],
  },
  {
    name: "Please Don't Tell (PDT)",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "East Village",
    streetAddress: "113 St Marks Pl",
    city: "New York",
    state: "NY",
    postalCode: "10009",
    latitude: 40.7265,
    longitude: -73.9835,
    timezone: TIMEZONE,
    website: "https://www.pdtnyc.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 3,
    musicType: null,
    hours: [
      { dayOfWeek: 0, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 1, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 2, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 3, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 4, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 5, openTime: "17:00", closeTime: "03:00" },
      { dayOfWeek: 6, openTime: "17:00", closeTime: "03:00" },
    ],
  },
  {
    name: "Superbueno",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "East Village",
    streetAddress: "13 1st Ave",
    city: "New York",
    state: "NY",
    postalCode: "10003",
    latitude: 40.7241,
    longitude: -73.9885,
    timezone: TIMEZONE,
    website: "https://www.superbuenonyc.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 2,
    musicType: null,
    hours: [], // not verified — left empty rather than guessed
  },
  {
    name: "Attaboy",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "Lower East Side",
    streetAddress: "134 Eldridge St",
    city: "New York",
    state: "NY",
    postalCode: "10002",
    latitude: 40.7188,
    longitude: -73.9917,
    timezone: TIMEZONE,
    website: null, // genuinely has no official website — no sign, no menu, by design
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 3,
    musicType: null,
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "17:00", closeTime: "03:00" })),
  },
  {
    name: "Spring Lounge",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "Nolita",
    streetAddress: "48 Spring St",
    city: "New York",
    state: "NY",
    postalCode: "10012",
    latitude: 40.7223,
    longitude: -73.9958,
    timezone: TIMEZONE,
    website: null,
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 1,
    musicType: null,
    hours: [], // not verified — left empty rather than guessed
  },
  {
    name: "Temple Bar",
    subcategory: null,
    venueType: "LOUNGE",
    neighborhood: "NoHo",
    streetAddress: "332 Lafayette St",
    city: "New York",
    state: "NY",
    postalCode: "10012",
    latitude: 40.7259,
    longitude: -73.9962,
    timezone: TIMEZONE,
    website: "https://www.templebar.co/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 3,
    musicType: null,
    hours: [
      { dayOfWeek: 1, openTime: "17:00", closeTime: "01:00" },
      { dayOfWeek: 2, openTime: "17:00", closeTime: "01:00" },
      { dayOfWeek: 3, openTime: "17:00", closeTime: "01:00" },
      { dayOfWeek: 4, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 5, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 6, openTime: "17:00", closeTime: "02:00" },
      { dayOfWeek: 0, openTime: "17:00", closeTime: "00:00" },
    ],
  },
  {
    name: "The Tippler",
    subcategory: null,
    venueType: "LOUNGE",
    neighborhood: "Chelsea",
    streetAddress: "425 W 15th St",
    city: "New York",
    state: "NY",
    postalCode: "10011",
    latitude: 40.7422,
    longitude: -74.0058,
    timezone: TIMEZONE,
    website: "http://www.thetippler.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 2,
    musicType: null,
    hours: [
      { dayOfWeek: 1, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 2, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 3, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 4, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 5, openTime: "16:00", closeTime: "03:00" },
      { dayOfWeek: 6, openTime: "15:00", closeTime: "03:00" },
      { dayOfWeek: 0, openTime: "16:00", closeTime: "00:00" },
    ],
  },
  {
    name: "Top of the Standard",
    subcategory: null,
    venueType: "ROOFTOP",
    neighborhood: "Meatpacking District",
    streetAddress: "848 Washington St",
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: 40.7406,
    longitude: -74.0089,
    timezone: TIMEZONE,
    website: null,
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 4,
    musicType: null,
    hours: [
      { dayOfWeek: 1, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 2, openTime: "16:00", closeTime: "00:00" },
      { dayOfWeek: 3, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 4, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 5, openTime: "16:00", closeTime: "02:00" },
      { dayOfWeek: 6, openTime: "14:00", closeTime: "02:00" },
      { dayOfWeek: 0, openTime: "14:00", closeTime: "00:00" },
    ],
  },
  {
    name: "Milady's",
    subcategory: null,
    venueType: "BAR",
    neighborhood: "SoHo",
    streetAddress: "160 Prince St",
    city: "New York",
    state: "NY",
    postalCode: "10012",
    latitude: 40.7256,
    longitude: -73.9998,
    timezone: TIMEZONE,
    website: "https://www.miladysnyc.com/",
    instagramHandle: null,
    capacityEstimate: null,
    priceLevel: 2,
    musicType: null,
    hours: [], // not verified — left empty rather than guessed
  },
];

async function main() {
  // createVenueAdmin() slugifies with a random suffix each call, so there's no fixed slug
  // to dedupe against — check by (name, streetAddress) instead so re-running this script
  // doesn't create duplicates.
  const existing = await listAllVenuesForAdmin();
  const existingKey = new Set(existing.map((v) => `${v.name}|${v.streetAddress}`));

  let created = 0;
  let skipped = 0;
  for (const v of VENUES) {
    if (existingKey.has(`${v.name}|${v.streetAddress}`)) {
      console.log(`Skipping (already exists): ${v.name}`);
      skipped++;
      continue;
    }
    await createVenueAdmin({ ...v, category: "Nightlife", isActive: true });
    console.log(`Added: ${v.name} (${v.neighborhood})`);
    created++;
  }
  console.log(`\nDone. ${created} added, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
