/**
 * Generates the PULSE demo dataset directly against Supabase: ~150 Manhattan venues,
 * hourly baselines, demo accounts, and hand-tuned showcase venues. Run with `npm run seed`
 * (loads .env.local via Node's --env-file, so NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY must be set there — see README §15).
 *
 * Safely re-runnable: deletes only the known demo accounts (by email, cascading away
 * everything scoped to them) and wipes+regenerates all venues, without touching any other
 * real user's account.
 */
import { randomUUID } from "node:crypto";
import { NEIGHBORHOODS, DEMO_TIMEZONE, REPORT_COOLDOWN_MINUTES, TRUST_SCORE_DEFAULT } from "../src/config/constants";
import { seededPointNear, mulberry32 } from "../src/lib/geo";
import { expectedActivityScore, expectedWaitScore } from "../src/lib/simulation/activityCurve";
import { simulateReportsForVenue } from "../src/lib/simulation/simulateNight";
import { calculatePulseScore } from "../src/lib/pulse/calculatePulseScore";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { buildTypicalHours } from "../src/lib/venues/typicalHours";
import type {
  CrowdLevel,
  EnergyLevel,
  Friendship,
  PresenceEvent,
  PresencePreferences,
  Profile,
  SavedVenue,
  UserTrustScore,
  Venue,
  VenueEvent,
  VenueHourlyBaseline,
  VenueHours,
  VenueReport,
  VenueSignalSnapshot,
  VenueType,
  WaitLevel,
} from "../src/types";

const now = new Date();
const DEMO_PASSWORD = "pulsedemo123";

function uid() {
  return randomUUID();
}

function slugify(name: string, suffix: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${suffix}`;
}

/**
 * The DB enforces one report per (venue, user) per REPORT_COOLDOWN_MINUTES window via a
 * real GiST exclusion constraint (supabase/migrations/0001_init.sql) — the local dev store
 * this generator originally targeted had no such constraint, so both the random background
 * simulator (simulateReportsForVenue, which can coincidentally re-pick the same reporter
 * within the window) and the hand-tuned showcase section (which deliberately cycles a small
 * reporter pool across many closely-spaced reports) can produce genuine collisions. Rather
 * than special-case each generator, resolve it once here: keep the earliest report in each
 * overlapping cluster per (venue, user) and drop the rest, which is also the more realistic
 * choice (a real person doesn't file two reports for the same place 12 minutes apart).
 */
function dedupeReportsForCooldown(reports: VenueReport[]): VenueReport[] {
  const cooldownMs = REPORT_COOLDOWN_MINUTES * 60_000;
  const lastKeptByKey = new Map<string, number>();
  const kept: VenueReport[] = [];
  for (const r of [...reports].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    const key = `${r.venueId}|${r.userId}`;
    const t = new Date(r.createdAt).getTime();
    const last = lastKeptByKey.get(key);
    if (last !== undefined && t - last < cooldownMs) continue;
    lastKeptByKey.set(key, t);
    kept.push(r);
  }
  return kept;
}

async function insertBatched(table: string, rows: Record<string, unknown>[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin().from(table).insert(chunk);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 0. Reset — remove only the known demo accounts (cascades everything scoped to
//    them: trust scores, presence prefs, friendships, reports, presence, saved), then
//    wipe all venues (cascades hours/events/reports/snapshots/baselines/presence/saved).
// ---------------------------------------------------------------------------

const DEMO_EMAILS = [
  "demo@pulse.app",
  "james@pulse.app",
  "conor@pulse.app",
  "maria@pulse.app",
  "priya@pulse.app",
  "liam@pulse.app",
  "ava@pulse.app",
];

async function resetDemoData() {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const demoEmailSet = new Set(DEMO_EMAILS);
  for (const u of data.users) {
    if (u.email && demoEmailSet.has(u.email)) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
    }
  }
  const { error: venueDelErr } = await admin.from("venues").delete().not("id", "is", null);
  if (venueDelErr) throw new Error(`Clearing venues failed: ${venueDelErr.message}`);
}

// ---------------------------------------------------------------------------
// 1. Demo accounts — real Supabase Auth users (email_confirm: true, no email flow
//    configured), each paired with a profiles row.
// ---------------------------------------------------------------------------

interface SeededPerson {
  profile: Profile;
}

async function makePerson(email: string, displayName: string, username: string, role: Profile["role"] = "USER"): Promise<SeededPerson> {
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${email}) failed: ${error?.message}`);

  const createdAt = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const profile: Profile = {
    id: uid(),
    authUserId: data.user.id,
    username,
    displayName,
    avatarUrl: null,
    homeCity: "New York City",
    interests: ["BAR", "CLUB", "ROOFTOP"],
    role,
    createdAt,
    updatedAt: createdAt,
  };
  return { profile };
}

async function seedAccountsAndSocial() {
  // ADMIN so the seeded demo account can reach /admin without needing INITIAL_ADMIN_EMAIL —
  // see README's admin-panel section.
  const demoUser = await makePerson("demo@pulse.app", "Jordan Rivera", "jordanr", "ADMIN");
  const reporterPool: SeededPerson[] = [
    await makePerson("james@pulse.app", "James Okafor", "jamesok"),
    await makePerson("conor@pulse.app", "Conor Blake", "conorb"),
    await makePerson("maria@pulse.app", "Maria Santos", "mariasantos"),
    await makePerson("priya@pulse.app", "Priya Nair", "priyan"),
    await makePerson("liam@pulse.app", "Liam Chen", "liamc"),
    await makePerson("ava@pulse.app", "Ava Thompson", "avat"),
  ];

  const profiles: Profile[] = [demoUser.profile, ...reporterPool.map((r) => r.profile)];
  const userTrustScores: UserTrustScore[] = profiles.map((p) => ({
    userId: p.id,
    trustScore: TRUST_SCORE_DEFAULT + (p === demoUser.profile ? 0 : 0.15),
    reportsSubmitted: p === demoUser.profile ? 0 : 12,
    reportsConfirmed: p === demoUser.profile ? 0 : 9,
    reportsFlagged: 0,
    updatedAt: now.toISOString(),
  }));

  const nowIso = now.toISOString();
  const friendships: Friendship[] = [
    { id: uid(), requesterId: demoUser.profile.id, addresseeId: reporterPool[0].profile.id, status: "ACCEPTED", createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), requesterId: demoUser.profile.id, addresseeId: reporterPool[1].profile.id, status: "ACCEPTED", createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), requesterId: reporterPool[2].profile.id, addresseeId: demoUser.profile.id, status: "ACCEPTED", createdAt: nowIso, updatedAt: nowIso },
    { id: uid(), requesterId: reporterPool[3].profile.id, addresseeId: demoUser.profile.id, status: "PENDING", createdAt: nowIso, updatedAt: nowIso },
  ];
  const closeFriends = [{ ownerId: demoUser.profile.id, friendProfileId: reporterPool[0].profile.id }];

  const presencePreferences: PresencePreferences[] = [...reporterPool.map((r) => r.profile), demoUser.profile].map((p) => ({
    userId: p.id,
    defaultVisibility: "FRIENDS",
    allowVenuePresence: true,
    allowNearbyPresence: true,
    allowRecentPresence: true,
    presenceTimeoutMinutes: 120,
    updatedAt: nowIso,
  }));

  return { demoUser, reporterPool, profiles, userTrustScores, friendships, closeFriends, presencePreferences };
}

// ---------------------------------------------------------------------------
// 2. Venues
// ---------------------------------------------------------------------------

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

const MUSIC_BY_TYPE: Record<VenueType, (string | null)[]> = {
  CLUB: ["House", "Techno", "Disco", "Hip-Hop", "Open Format"],
  BAR: ["Rock", "Indie", "Open Format", null],
  LOUNGE: ["R&B", "Jazz", "Lo-fi", null],
  ROOFTOP: ["Open Format", "House", null],
  RESTAURANT: [null, "Jazz"],
  LIVE_MUSIC: ["Live Bands", "Jazz", "Indie", "Singer-Songwriter"],
  CAFE: [null],
  EVENT_SPACE: [null],
  OTHER: [null],
};

const CAPACITY_RANGE: Record<VenueType, [number, number]> = {
  CLUB: [200, 600],
  BAR: [40, 120],
  LOUNGE: [60, 150],
  ROOFTOP: [80, 200],
  RESTAURANT: [40, 100],
  LIVE_MUSIC: [100, 350],
  CAFE: [20, 50],
  EVENT_SPACE: [150, 400],
  OTHER: [50, 100],
};

const NEIGHBORHOOD_STREETS: Record<string, string[]> = {
  "west-village": ["Bleecker St", "Christopher St", "West 4th St", "Hudson St", "Greenwich St", "Perry St"],
  "greenwich-village": ["MacDougal St", "Washington Square W", "Sullivan St", "Waverly Pl"],
  soho: ["Spring St", "Prince St", "Mercer St", "Broome St", "Grand St"],
  les: ["Rivington St", "Ludlow St", "Orchard St", "Delancey St", "Clinton St"],
  "east-village": ["St Marks Pl", "Avenue A", "Avenue B", "1st Ave", "2nd Ave"],
  chelsea: ["W 23rd St", "W 27th St", "10th Ave", "9th Ave", "W 19th St"],
  meatpacking: ["Washington St", "W 14th St", "Gansevoort St", "9th Ave"],
  nolita: ["Mulberry St", "Elizabeth St", "Mott St"],
  noho: ["Bond St", "Great Jones St", "Lafayette St"],
};

const NEIGHBORHOOD_TYPE_WEIGHTS: Record<string, Partial<Record<VenueType, number>>> = {
  "west-village": { BAR: 40, LOUNGE: 20, RESTAURANT: 20, LIVE_MUSIC: 10, CAFE: 10 },
  "greenwich-village": { BAR: 35, LIVE_MUSIC: 20, RESTAURANT: 20, CAFE: 15, LOUNGE: 10 },
  soho: { RESTAURANT: 35, LOUNGE: 20, BAR: 20, CAFE: 15, ROOFTOP: 10 },
  les: { BAR: 35, CLUB: 20, LIVE_MUSIC: 20, LOUNGE: 15, RESTAURANT: 10 },
  "east-village": { BAR: 40, LIVE_MUSIC: 20, RESTAURANT: 15, CAFE: 15, LOUNGE: 10 },
  chelsea: { CLUB: 30, BAR: 20, RESTAURANT: 20, ROOFTOP: 15, LOUNGE: 15 },
  meatpacking: { CLUB: 35, LOUNGE: 25, ROOFTOP: 20, RESTAURANT: 20 },
  nolita: { RESTAURANT: 30, CAFE: 25, BAR: 25, LOUNGE: 20 },
  noho: { BAR: 30, RESTAURANT: 25, LOUNGE: 20, LIVE_MUSIC: 15, CLUB: 10 },
};

function weightedPick<T extends string>(rand: () => number, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

const usedNames = new Set<string>();
function pickName(rand: () => number, venueType: VenueType): string {
  const pool = NAME_POOLS[venueType];
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = pool[Math.floor(rand() * pool.length)];
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
  const fallback = `${pool[Math.floor(rand() * pool.length)]} No. ${Math.floor(rand() * 90 + 10)}`;
  usedNames.add(fallback);
  return fallback;
}

function generateBackgroundVenues(): Venue[] {
  const allVenues: Venue[] = [];
  const backgroundVenueCountPerNeighborhood = 15;
  let venueIndex = 0;

  for (const neighborhood of NEIGHBORHOODS) {
    const weights = NEIGHBORHOOD_TYPE_WEIGHTS[neighborhood.slug];
    const streets = NEIGHBORHOOD_STREETS[neighborhood.slug];

    for (let i = 0; i < backgroundVenueCountPerNeighborhood; i++) {
      venueIndex++;
      const rand = mulberry32(venueIndex * 7919);
      const venueType = weightedPick(rand, weights);
      const name = pickName(rand, venueType);
      const point = seededPointNear(neighborhood.center, neighborhood.radiusMeters, venueIndex);
      const street = streets[Math.floor(rand() * streets.length)];
      const [capMin, capMax] = CAPACITY_RANGE[venueType];
      const musicOptions = MUSIC_BY_TYPE[venueType];
      const id = uid();

      const venue: Venue = {
        id,
        externalPlaceId: null,
        name,
        slug: slugify(name, id.slice(0, 6)),
        category: venueType === "RESTAURANT" ? "Restaurant & Bar" : venueType === "LIVE_MUSIC" ? "Live Music Venue" : "Nightlife",
        subcategory: null,
        venueType,
        neighborhood: neighborhood.name,
        streetAddress: `${Math.floor(rand() * 400 + 10)} ${street}`,
        city: "New York",
        state: "NY",
        postalCode: "10014",
        latitude: point.lat,
        longitude: point.lng,
        timezone: DEMO_TIMEZONE,
        website: null,
        instagramHandle: `@${slugify(name, "").replace(/-/g, "")}`,
        capacityEstimate: Math.round(capMin + rand() * (capMax - capMin)),
        priceLevel: Math.min(4, Math.max(1, Math.round(1 + rand() * 3))) as 1 | 2 | 3 | 4,
        musicType: musicOptions[Math.floor(rand() * musicOptions.length)],
        isActive: true,
        hours: [],
        businessStatus: null,
        externalRating: null,
        externalRatingCount: null,
        claimStatus: "UNCLAIMED",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      venue.hours = buildTypicalHours(venueType).map((h) => ({
        id: uid(),
        venueId: venue.id,
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed ?? false,
        openTime: h.openTime ?? null,
        closeTime: h.closeTime ?? null,
        source: h.source ?? "SEED",
        lastVerifiedAt: h.lastVerifiedAt ?? null,
      }));
      allVenues.push(venue);
    }
  }
  return allVenues;
}

// ---------------------------------------------------------------------------
// 2b. Showcase venues (hand-placed, hand-tuned — see IMPLEMENTATION_PLAN.md)
// ---------------------------------------------------------------------------

// Open all day, every day (not realistic club hours) — these five venues exist
// specifically so the showcase narrative is clickable no matter what time it is
// when someone runs the seed script or loads the demo. A partial window (even a
// generous one, e.g. 08:00-04:00) still has a dead gap that real time eventually
// lands in — this hit exactly that bug once already during development.
function buildShowcaseHours(venueId: string): VenueHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    id: uid(),
    venueId,
    dayOfWeek,
    isClosed: false,
    openTime: "00:00",
    closeTime: "23:59",
    source: "SEED" as const,
    lastVerifiedAt: null,
  }));
}

function showcaseVenue(existingCount: number, fields: {
  name: string;
  venueType: VenueType;
  neighborhoodSlug: string;
  musicType: string | null;
  capacity: number;
}): Venue {
  const neighborhood = NEIGHBORHOODS.find((n) => n.slug === fields.neighborhoodSlug)!;
  const point = seededPointNear(neighborhood.center, neighborhood.radiusMeters * 0.4, existingCount + 1000);
  const id = uid();
  const street = NEIGHBORHOOD_STREETS[fields.neighborhoodSlug][0];
  const venue: Venue = {
    id,
    externalPlaceId: null,
    name: fields.name,
    slug: slugify(fields.name, "demo"),
    category: fields.venueType === "RESTAURANT" ? "Restaurant & Bar" : "Nightlife",
    subcategory: "Showcase",
    venueType: fields.venueType,
    neighborhood: neighborhood.name,
    streetAddress: `${Math.floor(Math.random() * 300 + 10)} ${street}`,
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: point.lat,
    longitude: point.lng,
    timezone: DEMO_TIMEZONE,
    website: null,
    instagramHandle: `@${slugify(fields.name, "").replace(/-/g, "")}`,
    capacityEstimate: fields.capacity,
    priceLevel: 3,
    musicType: fields.musicType,
    isActive: true,
    hours: [],
    businessStatus: null,
    externalRating: null,
    externalRatingCount: null,
    claimStatus: "UNCLAIMED",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  venue.hours = buildShowcaseHours(venue.id);
  return venue;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Resetting demo data...");
  await resetDemoData();

  console.log("Creating demo accounts...");
  const { demoUser, reporterPool, profiles, userTrustScores, friendships, closeFriends, presencePreferences } =
    await seedAccountsAndSocial();
  const reporterProfileIds = reporterPool.map((r) => r.profile.id);

  const allVenues = generateBackgroundVenues();

  const littleSister = showcaseVenue(allVenues.length, { name: "Little Sister (Demo)", venueType: "CLUB", neighborhoodSlug: "west-village", musicType: "House", capacity: 350 });
  const dante = showcaseVenue(allVenues.length, { name: "Dante (Demo)", venueType: "LOUNGE", neighborhoodSlug: "greenwich-village", musicType: "R&B", capacity: 120 });
  const nightOwl = showcaseVenue(allVenues.length, { name: "Night Owl (Demo)", venueType: "CLUB", neighborhoodSlug: "les", musicType: "Techno", capacity: 400 });
  const room57 = showcaseVenue(allVenues.length, { name: "Room 57 (Demo)", venueType: "LOUNGE", neighborhoodSlug: "nolita", musicType: "Jazz", capacity: 90 });
  const theRoof = showcaseVenue(allVenues.length, { name: "The Roof (Demo)", venueType: "ROOFTOP", neighborhoodSlug: "meatpacking", musicType: "Open Format", capacity: 200 });
  allVenues.push(littleSister, dante, nightOwl, room57, theRoof);

  // ---- 3. Hourly baselines for every venue (7 days x 24 hours) ----
  const venueHourlyBaselines: VenueHourlyBaseline[] = [];
  for (const venue of allVenues) {
    const seed = venue.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const activity = expectedActivityScore(venue.venueType, seed, day, hour);
        venueHourlyBaselines.push({
          id: uid(),
          venueId: venue.id,
          dayOfWeek: day,
          hourOfDay: hour,
          expectedActivityScore: activity,
          expectedWaitScore: expectedWaitScore(activity),
          // Deliberately low: this is a category-typical estimate, not measured history —
          // a real launch starts with zero real samples, and confidence should say so.
          sampleCount: 1,
          updatedAt: now.toISOString(),
        });
      }
    }
  }

  // ---- 4. Events ----
  const venueEvents: VenueEvent[] = [];
  const liveMusicVenues = allVenues.filter((v) => v.venueType === "LIVE_MUSIC").slice(0, 6);
  for (const venue of liveMusicVenues) {
    const startsAt = new Date(now.getTime() + 45 * 60_000);
    venueEvents.push({
      id: uid(),
      venueId: venue.id,
      name: "Live set",
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 3 * 3_600_000).toISOString(),
      eventType: "LIVE_BAND",
      source: "SEED",
      externalUrl: null,
      createdAt: now.toISOString(),
    });
  }
  function addEvent(venueId: string, name: string, startsAtOffsetMin: number, durationMin: number, eventType: string) {
    const startsAt = new Date(now.getTime() + startsAtOffsetMin * 60_000);
    venueEvents.push({
      id: uid(),
      venueId,
      name,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + durationMin * 60_000).toISOString(),
      eventType,
      source: "SEED",
      externalUrl: null,
      createdAt: now.toISOString(),
    });
  }
  addEvent(littleSister.id, "Guest DJ set", -30, 240, "DJ_SET");
  addEvent(theRoof.id, "Sunset social", 40, 180, "SPECIAL");

  // ---- 5. Background reports for ordinary venues ----
  let venueReports: VenueReport[] = [];
  const showcaseIds = new Set([littleSister.id, dante.id, nightOwl.id, room57.id, theRoof.id]);
  for (const venue of allVenues) {
    if (showcaseIds.has(venue.id)) continue;
    const reports = simulateReportsForVenue({ venue, now, reporterProfileIds, maxReports: 3 });
    for (const r of reports) venueReports.push({ id: uid(), venueId: venue.id, ...r });
  }

  // ---- 6. Hand-tuned showcase venue state ----
  const venueSignalSnapshots: VenueSignalSnapshot[] = [];
  function addReport(venueId: string, userId: string, ageMinutes: number, crowdLevel: CrowdLevel, waitLevel: WaitLevel, energyLevel: EnergyLevel, isVerifiedNearby: boolean, trustWeightAtSubmission: number, crowdNote: string | null = null) {
    venueReports.push({
      id: uid(),
      venueId,
      userId,
      createdAt: new Date(now.getTime() - ageMinutes * 60_000).toISOString(),
      crowdLevel,
      waitLevel,
      energyLevel,
      crowdNote,
      reportSource: "APP",
      isVerifiedNearby,
      trustWeightAtSubmission,
    });
  }
  function addHistorySnapshot(venueId: string, minutesAgo: number, pulseScore: number) {
    venueSignalSnapshots.push({
      id: uid(),
      venueId,
      capturedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
      pulseScore,
      confidenceScore: 60,
      crowdScore: pulseScore,
      trendScore: 50,
      reportScore: pulseScore,
      historicalScore: pulseScore,
      eventScore: 50,
      friendActivityScore: 50,
      trendDirection: "STABLE",
      waitEstimate: null,
      expectedPeak: null,
      signalVersion: 1,
    });
  }

  // Little Sister: hot, rising fast, high confidence, verified crowd, active DJ event
  for (let i = 0; i < 9; i++) {
    addReport(littleSister.id, reporterProfileIds[i % reporterProfileIds.length], 2 + i * 2, i % 4 === 0 ? "BUSY" : "PACKED", i % 3 === 0 ? "MEDIUM" : "LONG", i % 2 === 0 ? "VERY_HIGH" : "HIGH", true, 0.7 + (i % 3) * 0.08, i === 0 ? "Dance floor opened up" : null);
  }
  addHistorySnapshot(littleSister.id, 45, 58);
  addHistorySnapshot(littleSister.id, 30, 66);
  addHistorySnapshot(littleSister.id, 15, 78);

  // Dante: stable, moderate-high, low wait, good agreement
  for (let i = 0; i < 5; i++) {
    addReport(dante.id, reporterProfileIds[i % reporterProfileIds.length], 5 + i * 6, "BUSY", "SHORT", "GOOD", true, 0.75);
  }
  addHistorySnapshot(dante.id, 45, 80);
  addHistorySnapshot(dante.id, 30, 81);
  addHistorySnapshot(dante.id, 15, 82);

  // Night Owl: still busy but falling — older reports hotter than recent ones, long wait
  addReport(nightOwl.id, reporterProfileIds[0], 55, "PACKED", "VERY_LONG", "HIGH", true, 0.8);
  addReport(nightOwl.id, reporterProfileIds[1], 40, "PACKED", "VERY_LONG", "HIGH", true, 0.7);
  addReport(nightOwl.id, reporterProfileIds[2], 20, "BUSY", "LONG", "GOOD", true, 0.75);
  addReport(nightOwl.id, reporterProfileIds[3], 6, "BUSY", "LONG", "GOOD", false, 0.6, "Line still long but moving");
  addHistorySnapshot(nightOwl.id, 45, 96);
  addHistorySnapshot(nightOwl.id, 30, 92);
  addHistorySnapshot(nightOwl.id, 15, 88);

  // Room 57: quiet-but-good — moderate crowd, no wait, good energy, strong agreement
  for (let i = 0; i < 4; i++) {
    addReport(room57.id, reporterProfileIds[i % reporterProfileIds.length], 8 + i * 5, "MODERATE", "NONE", "GOOD", true, 0.7);
  }
  addHistorySnapshot(room57.id, 30, 60);
  addHistorySnapshot(room57.id, 15, 61);

  // The Roof: rising ahead of an upcoming event
  addReport(theRoof.id, reporterProfileIds[0], 10, "MODERATE", "SHORT", "GOOD", true, 0.65);
  addReport(theRoof.id, reporterProfileIds[1], 4, "BUSY", "SHORT", "HIGH", true, 0.7);
  addHistorySnapshot(theRoof.id, 30, 55);
  addHistorySnapshot(theRoof.id, 15, 64);

  const beforeDedupe = venueReports.length;
  venueReports = dedupeReportsForCooldown(venueReports);
  if (venueReports.length < beforeDedupe) {
    console.log(`Dropped ${beforeDedupe - venueReports.length} reports that collided with the ${REPORT_COOLDOWN_MINUTES}-minute per-venue cooldown.`);
  }

  // ---- 6b. Presence — a few friends "at" venues right now, expiring naturally ----
  const presenceEvents: PresenceEvent[] = [
    { id: uid(), userId: reporterPool[0].profile.id, venueId: littleSister.id, status: "AT_VENUE", visibility: "FRIENDS", startedAt: new Date(now.getTime() - 20 * 60_000).toISOString(), expiresAt: new Date(now.getTime() + 100 * 60_000).toISOString(), createdAt: new Date(now.getTime() - 20 * 60_000).toISOString() },
    { id: uid(), userId: reporterPool[1].profile.id, venueId: littleSister.id, status: "HEADING_THERE", visibility: "FRIENDS", startedAt: new Date(now.getTime() - 8 * 60_000).toISOString(), expiresAt: new Date(now.getTime() + 40 * 60_000).toISOString(), createdAt: new Date(now.getTime() - 8 * 60_000).toISOString() },
    { id: uid(), userId: reporterPool[2].profile.id, venueId: dante.id, status: "NEARBY", visibility: "FRIENDS", startedAt: new Date(now.getTime() - 5 * 60_000).toISOString(), expiresAt: new Date(now.getTime() + 55 * 60_000).toISOString(), createdAt: new Date(now.getTime() - 5 * 60_000).toISOString() },
  ];

  // ---- 7. Saved venues for the demo user ----
  const savedVenues: SavedVenue[] = [
    { userId: demoUser.profile.id, venueId: littleSister.id, createdAt: now.toISOString() },
    { userId: demoUser.profile.id, venueId: room57.id, createdAt: now.toISOString() },
  ];

  // ---- 8. Compute one live snapshot per venue for a distribution check ----
  const trustScores = new Map(userTrustScores.map((t) => [t.userId, t.trustScore]));
  const results: { name: string; type: VenueType; score: number; label: string; confidence: string }[] = [];
  for (const venue of allVenues) {
    const reports = venueReports.filter((r) => r.venueId === venue.id);
    const baselines = venueHourlyBaselines.filter((b) => b.venueId === venue.id);
    const events = venueEvents.filter((e) => e.venueId === venue.id);
    const history = venueSignalSnapshots.filter((s) => s.venueId === venue.id);
    const friendsPresentCount = presenceEvents.filter((p) => p.venueId === venue.id && p.status === "AT_VENUE").length;

    const result = calculatePulseScore({ venue, now, reports, baselines, events, friendsPresentCount, history, trustScores, effectiveHours: venue.hours });
    venueSignalSnapshots.push({
      id: uid(),
      venueId: venue.id,
      capturedAt: now.toISOString(),
      pulseScore: result.pulseScore,
      confidenceScore: result.confidenceScore,
      crowdScore: result.components.find((c) => c.key === "liveReports")?.value ?? 0,
      trendScore: result.components.find((c) => c.key === "trend")?.value ?? 0,
      reportScore: result.components.find((c) => c.key === "liveReports")?.value ?? 0,
      historicalScore: result.components.find((c) => c.key === "historical")?.value ?? 0,
      eventScore: result.components.find((c) => c.key === "event")?.value ?? 0,
      friendActivityScore: result.components.find((c) => c.key === "friends")?.value ?? 0,
      trendDirection: result.trend,
      waitEstimate: result.waitEstimate,
      expectedPeak: result.expectedPeak,
      signalVersion: 1,
    });
    results.push({ name: venue.name, type: venue.venueType, score: result.pulseScore, label: result.pulseLabel, confidence: result.confidenceLabel });
  }

  // ---------------------------------------------------------------------------
  // Persist everything to Supabase, in FK dependency order.
  // ---------------------------------------------------------------------------

  console.log("Writing profiles and social data...");
  await insertBatched("profiles", profiles.map((p) => ({
    id: p.id, auth_user_id: p.authUserId, username: p.username, display_name: p.displayName,
    avatar_url: p.avatarUrl, home_city: p.homeCity, interests: p.interests, role: p.role,
    created_at: p.createdAt, updated_at: p.updatedAt,
  })));
  await insertBatched("user_trust_scores", userTrustScores.map((t) => ({
    user_id: t.userId, trust_score: t.trustScore, reports_submitted: t.reportsSubmitted,
    reports_confirmed: t.reportsConfirmed, reports_flagged: t.reportsFlagged, updated_at: t.updatedAt,
  })));
  await insertBatched("presence_preferences", presencePreferences.map((p) => ({
    user_id: p.userId, default_visibility: p.defaultVisibility, allow_venue_presence: p.allowVenuePresence,
    allow_nearby_presence: p.allowNearbyPresence, allow_recent_presence: p.allowRecentPresence,
    presence_timeout_minutes: p.presenceTimeoutMinutes, updated_at: p.updatedAt,
  })));
  await insertBatched("friendships", friendships.map((f) => ({
    id: f.id, requester_id: f.requesterId, addressee_id: f.addresseeId, status: f.status,
    created_at: f.createdAt, updated_at: f.updatedAt,
  })));
  await insertBatched("close_friends", closeFriends.map((c) => ({ owner_id: c.ownerId, friend_profile_id: c.friendProfileId })));

  console.log(`Writing ${allVenues.length} venues...`);
  await insertBatched("venues", allVenues.map((v) => ({
    id: v.id, external_place_id: v.externalPlaceId, name: v.name, slug: v.slug, category: v.category,
    subcategory: v.subcategory, venue_type: v.venueType, neighborhood: v.neighborhood, street_address: v.streetAddress,
    city: v.city, state: v.state, postal_code: v.postalCode, latitude: v.latitude, longitude: v.longitude,
    timezone: v.timezone, website: v.website, instagram_handle: v.instagramHandle, capacity_estimate: v.capacityEstimate,
    price_level: v.priceLevel, music_type: v.musicType, is_active: v.isActive, business_status: v.businessStatus,
    external_rating: v.externalRating, external_rating_count: v.externalRatingCount, claim_status: v.claimStatus,
    created_at: v.createdAt, updated_at: v.updatedAt,
  })));

  const allHours = allVenues.flatMap((v) => v.hours);
  console.log(`Writing ${allHours.length} venue hours rows...`);
  await insertBatched("venue_hours", allHours.map((h) => ({
    id: h.id, venue_id: h.venueId, day_of_week: h.dayOfWeek, open_time: h.openTime, close_time: h.closeTime,
  })));

  console.log(`Writing ${venueHourlyBaselines.length} hourly baseline rows...`);
  await insertBatched("venue_hourly_baselines", venueHourlyBaselines.map((b) => ({
    id: b.id, venue_id: b.venueId, day_of_week: b.dayOfWeek, hour_of_day: b.hourOfDay,
    expected_activity_score: b.expectedActivityScore, expected_wait_score: b.expectedWaitScore,
    sample_count: b.sampleCount, updated_at: b.updatedAt,
  })));

  await insertBatched("venue_events", venueEvents.map((e) => ({
    id: e.id, venue_id: e.venueId, name: e.name, starts_at: e.startsAt, ends_at: e.endsAt,
    event_type: e.eventType, source: e.source, external_url: e.externalUrl, created_at: e.createdAt,
  })));

  console.log(`Writing ${venueReports.length} reports...`);
  await insertBatched("venue_reports", venueReports.map((r) => ({
    id: r.id, venue_id: r.venueId, user_id: r.userId, crowd_level: r.crowdLevel, wait_level: r.waitLevel,
    energy_level: r.energyLevel, crowd_note: r.crowdNote, report_source: r.reportSource,
    is_verified_nearby: r.isVerifiedNearby, trust_weight_at_submission: r.trustWeightAtSubmission,
    created_at: r.createdAt,
  })));

  console.log(`Writing ${venueSignalSnapshots.length} signal snapshots...`);
  await insertBatched("venue_signal_snapshots", venueSignalSnapshots.map((s) => ({
    id: s.id, venue_id: s.venueId, captured_at: s.capturedAt, pulse_score: s.pulseScore,
    confidence_score: s.confidenceScore, crowd_score: s.crowdScore, trend_score: s.trendScore,
    report_score: s.reportScore, historical_score: s.historicalScore, event_score: s.eventScore,
    friend_activity_score: s.friendActivityScore, trend_direction: s.trendDirection,
    wait_min_minutes: s.waitEstimate?.minMinutes ?? null, wait_max_minutes: s.waitEstimate?.maxMinutes ?? null,
    expected_peak_start: s.expectedPeak?.start ?? null, expected_peak_end: s.expectedPeak?.end ?? null,
    signal_version: s.signalVersion,
  })));

  await insertBatched("presence_events", presenceEvents.map((p) => ({
    id: p.id, user_id: p.userId, venue_id: p.venueId, status: p.status, visibility: p.visibility,
    started_at: p.startedAt, expires_at: p.expiresAt, created_at: p.createdAt,
  })));

  await insertBatched("saved_venues", savedVenues.map((s) => ({ user_id: s.userId, venue_id: s.venueId, created_at: s.createdAt })));

  // ---------------------------------------------------------------------------
  // Summary report
  // ---------------------------------------------------------------------------

  const bands = { HOT_NOW: 0, VERY_ACTIVE: 0, BUSY: 0, MODERATE: 0, QUIET: 0, VERY_QUIET: 0 };
  for (const r of results) bands[r.label as keyof typeof bands]++;

  console.log(`\nSeeded ${allVenues.length} venues across ${NEIGHBORHOODS.length} neighborhoods.`);
  console.log(`Demo login: demo@pulse.app / ${DEMO_PASSWORD}\n`);
  console.log("Score distribution at seed time:");
  for (const [label, count] of Object.entries(bands)) {
    console.log(`  ${label.padEnd(12)} ${count}`);
  }

  console.log("\nShowcase venues:");
  for (const id of [littleSister.id, dante.id, nightOwl.id, room57.id, theRoof.id]) {
    const v = allVenues.find((x) => x.id === id)!;
    const r = results.find((x) => x.name === v.name);
    console.log(`  ${v.name.padEnd(24)} score=${r?.score} (${r?.label}) confidence=${r?.confidence}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
