import type {
  PulseResult,
  Venue,
  VenueEvent,
  VenueHourlyBaseline,
  VenueHours,
  VenueNightlyRollup,
  VenueReport,
  VenueSignalSnapshot,
  VenueSpecialHours,
  VenueType,
} from "@/types";
import type { BoundingBox } from "@/lib/geo";
import { isWithinBoundingBox } from "@/lib/geo";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrap } from "@/lib/supabase/unwrap";

// ---------------- row <-> domain mappers ----------------
// Postgres is snake_case; every domain type in @/types is camelCase. Kept local to this
// file (and social.ts's own copies for its tables) rather than shared, since each mapper is
// only ever used against its one matching table shape.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToHours(row: Row): VenueHours {
  return {
    id: row.id,
    venueId: row.venue_id,
    dayOfWeek: row.day_of_week,
    isClosed: row.is_closed,
    // Postgres `time` serializes as "HH:MM:SS" — the app's own format is "HH:mm" throughout.
    openTime: row.open_time == null ? null : String(row.open_time).slice(0, 5),
    closeTime: row.close_time == null ? null : String(row.close_time).slice(0, 5),
    source: row.source,
    lastVerifiedAt: row.last_verified_at,
  };
}

function rowToSpecialHours(row: Row): VenueSpecialHours {
  return {
    id: row.id,
    venueId: row.venue_id,
    specialDate: row.special_date,
    isClosed: row.is_closed,
    openTime: row.open_time == null ? null : String(row.open_time).slice(0, 5),
    closeTime: row.close_time == null ? null : String(row.close_time).slice(0, 5),
    reason: row.reason,
    source: row.source,
    lastVerifiedAt: row.last_verified_at,
  };
}

function rowToVenue(row: Row): Venue {
  return {
    id: row.id,
    externalPlaceId: row.external_place_id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    subcategory: row.subcategory,
    venueType: row.venue_type,
    neighborhood: row.neighborhood,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    website: row.website,
    instagramHandle: row.instagram_handle,
    capacityEstimate: row.capacity_estimate,
    priceLevel: row.price_level,
    musicType: row.music_type,
    isActive: row.is_active,
    hours: (row.venue_hours ?? []).map(rowToHours),
    businessStatus: row.business_status,
    externalRating: row.external_rating,
    externalRatingCount: row.external_rating_count,
    claimStatus: row.claim_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: Row): VenueEvent {
  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    eventType: row.event_type,
    source: row.source,
    externalUrl: row.external_url,
    createdAt: row.created_at,
  };
}

function rowToReport(row: Row): VenueReport {
  return {
    id: row.id,
    venueId: row.venue_id,
    userId: row.user_id,
    createdAt: row.created_at,
    crowdLevel: row.crowd_level,
    waitLevel: row.wait_level,
    energyLevel: row.energy_level,
    crowdNote: row.crowd_note,
    reportSource: row.report_source,
    isVerifiedNearby: row.is_verified_nearby,
    trustWeightAtSubmission: row.trust_weight_at_submission,
  };
}

function rowToBaseline(row: Row): VenueHourlyBaseline {
  return {
    id: row.id,
    venueId: row.venue_id,
    dayOfWeek: row.day_of_week,
    hourOfDay: row.hour_of_day,
    expectedActivityScore: row.expected_activity_score,
    expectedWaitScore: row.expected_wait_score,
    sampleCount: row.sample_count,
    updatedAt: row.updated_at,
  };
}

function rowToSnapshot(row: Row): VenueSignalSnapshot {
  return {
    id: row.id,
    venueId: row.venue_id,
    capturedAt: row.captured_at,
    pulseScore: row.pulse_score,
    confidenceScore: row.confidence_score,
    crowdScore: row.crowd_score,
    trendScore: row.trend_score,
    reportScore: row.report_score,
    historicalScore: row.historical_score,
    eventScore: row.event_score,
    friendActivityScore: row.friend_activity_score,
    trendDirection: row.trend_direction,
    waitEstimate:
      row.wait_min_minutes == null ? null : { minMinutes: row.wait_min_minutes, maxMinutes: row.wait_max_minutes },
    expectedPeak:
      row.expected_peak_start == null ? null : { start: row.expected_peak_start, end: row.expected_peak_end },
    signalVersion: row.signal_version,
  };
}

function rowToNightlyRollup(row: Row): VenueNightlyRollup {
  return {
    id: row.id,
    venueId: row.venue_id,
    nightlifeDate: row.nightlife_date,
    nightlifeDayOfWeek: row.nightlife_day_of_week,
    avgPulseScore: row.avg_pulse_score,
    peakPulseScore: row.peak_pulse_score,
    peakAt: row.peak_at,
    sampleCount: row.sample_count,
    reportCount: row.report_count,
    computedAt: row.computed_at,
  };
}

const VENUE_SELECT = "*, venue_hours(*)";

// ---------------- venues ----------------

export async function listVenues(): Promise<Venue[]> {
  const rows = unwrap(await supabaseAdmin().from("venues").select(VENUE_SELECT).eq("is_active", true));
  return rows.map(rowToVenue);
}

export async function getVenueById(id: string): Promise<Venue | undefined> {
  const row = unwrap(await supabaseAdmin().from("venues").select(VENUE_SELECT).eq("id", id).maybeSingle());
  return row ? rowToVenue(row) : undefined;
}

export async function getVenueBySlug(slug: string): Promise<Venue | undefined> {
  const row = unwrap(await supabaseAdmin().from("venues").select(VENUE_SELECT).eq("slug", slug).maybeSingle());
  return row ? rowToVenue(row) : undefined;
}

/** Batched sibling of getVenueById — one round-trip for N ids instead of N (used by
 * /api/saved, which otherwise fetches each saved venue individually). */
export async function getVenuesByIds(ids: string[]): Promise<Venue[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(await supabaseAdmin().from("venues").select(VENUE_SELECT).in("id", ids));
  return rows.map(rowToVenue);
}

// ---------------- venue admin CRUD ----------------
// Callers (API routes) are responsible for the admin-role check — these functions enforce
// nothing on their own, same convention as every other repository function in this file.

/** Unlike listVenues(), includes inactive venues — an admin needs to see what they've turned off. */
export async function listAllVenuesForAdmin(): Promise<Venue[]> {
  const rows = unwrap(await supabaseAdmin().from("venues").select(VENUE_SELECT).order("name"));
  return rows.map(rowToVenue);
}

export interface NewVenueHoursInput {
  dayOfWeek: number;
  isClosed?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  source?: import("@/types").HoursSource;
  lastVerifiedAt?: string | null;
}

export type NewVenueInput = Omit<
  Venue,
  "id" | "slug" | "hours" | "createdAt" | "updatedAt" | "externalPlaceId" | "businessStatus" | "externalRating" | "externalRatingCount" | "claimStatus"
> & {
  hours: NewVenueHoursInput[];
};

function slugifyVenueName(name: string, disambiguator: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${disambiguator}`;
}

/** Used by createVenueAdmin/updateVenueAdmin (true admin-facing functions — the only
 * real-world callers that ever pass non-empty hours today) so hand-entered hours default
 * to source: "ADMIN" and a fresh verification timestamp without every call site having to
 * say so explicitly. */
async function replaceHours(venueId: string, hours: NewVenueHoursInput[]) {
  unwrap(await supabaseAdmin().from("venue_hours").delete().eq("venue_id", venueId));
  if (hours.length === 0) return;
  const now = new Date().toISOString();
  unwrap(
    await supabaseAdmin()
      .from("venue_hours")
      .insert(
        hours.map((h) => ({
          venue_id: venueId,
          day_of_week: h.dayOfWeek,
          is_closed: h.isClosed ?? false,
          open_time: h.isClosed ? null : (h.openTime ?? null),
          close_time: h.isClosed ? null : (h.closeTime ?? null),
          source: h.source ?? "ADMIN",
          last_verified_at: h.lastVerifiedAt ?? now,
        }))
      )
  );
}

export async function createVenueAdmin(fields: NewVenueInput): Promise<Venue> {
  const { hours, ...rest } = fields;
  const row = unwrap(
    await supabaseAdmin()
      .from("venues")
      .insert({
        name: rest.name,
        slug: slugifyVenueName(rest.name, Math.random().toString(36).slice(2, 8)),
        category: rest.category,
        subcategory: rest.subcategory,
        venue_type: rest.venueType,
        neighborhood: rest.neighborhood,
        street_address: rest.streetAddress,
        city: rest.city,
        state: rest.state,
        postal_code: rest.postalCode,
        latitude: rest.latitude,
        longitude: rest.longitude,
        timezone: rest.timezone,
        website: rest.website,
        instagram_handle: rest.instagramHandle,
        capacity_estimate: rest.capacityEstimate,
        price_level: rest.priceLevel,
        music_type: rest.musicType,
        is_active: rest.isActive,
      })
      .select()
      .single()
  );
  await replaceHours(row.id, hours);
  return (await getVenueById(row.id))!;
}

export type VenueAdminPatch = Partial<Omit<Venue, "id" | "slug" | "hours" | "createdAt" | "updatedAt">> & {
  hours?: NewVenueHoursInput[];
};

export async function updateVenueAdmin(id: string, patch: VenueAdminPatch): Promise<Venue | null> {
  const { hours, ...rest } = patch;
  const columns: Row = {};
  if (rest.name !== undefined) columns.name = rest.name;
  if (rest.category !== undefined) columns.category = rest.category;
  if (rest.subcategory !== undefined) columns.subcategory = rest.subcategory;
  if (rest.venueType !== undefined) columns.venue_type = rest.venueType;
  if (rest.neighborhood !== undefined) columns.neighborhood = rest.neighborhood;
  if (rest.streetAddress !== undefined) columns.street_address = rest.streetAddress;
  if (rest.city !== undefined) columns.city = rest.city;
  if (rest.state !== undefined) columns.state = rest.state;
  if (rest.postalCode !== undefined) columns.postal_code = rest.postalCode;
  if (rest.latitude !== undefined) columns.latitude = rest.latitude;
  if (rest.longitude !== undefined) columns.longitude = rest.longitude;
  if (rest.timezone !== undefined) columns.timezone = rest.timezone;
  if (rest.website !== undefined) columns.website = rest.website;
  if (rest.instagramHandle !== undefined) columns.instagram_handle = rest.instagramHandle;
  if (rest.capacityEstimate !== undefined) columns.capacity_estimate = rest.capacityEstimate;
  if (rest.priceLevel !== undefined) columns.price_level = rest.priceLevel;
  if (rest.musicType !== undefined) columns.music_type = rest.musicType;
  if (rest.isActive !== undefined) columns.is_active = rest.isActive;
  if (rest.externalPlaceId !== undefined) columns.external_place_id = rest.externalPlaceId;
  if (rest.businessStatus !== undefined) columns.business_status = rest.businessStatus;
  if (rest.externalRating !== undefined) columns.external_rating = rest.externalRating;
  if (rest.externalRatingCount !== undefined) columns.external_rating_count = rest.externalRatingCount;
  if (rest.claimStatus !== undefined) columns.claim_status = rest.claimStatus;

  if (Object.keys(columns).length > 0) {
    const { error } = await supabaseAdmin().from("venues").update(columns).eq("id", id);
    if (error) throw new Error(`Supabase error: ${error.message}`);
  } else {
    const existing = await getVenueById(id);
    if (!existing) return null;
  }
  if (hours) await replaceHours(id, hours);
  return (await getVenueById(id)) ?? null;
}

export async function deleteVenueAdmin(id: string): Promise<boolean> {
  // Every table referencing venues (hours, events, reports, snapshots, baselines, presence,
  // saved) does so with `on delete cascade` in the migration, so this one delete is enough —
  // no manual multi-table cleanup needed (unlike the old in-memory version).
  const { error, count } = await supabaseAdmin().from("venues").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function getVenueByExternalPlaceId(externalPlaceId: string): Promise<Venue | undefined> {
  const row = unwrap(
    await supabaseAdmin().from("venues").select(VENUE_SELECT).eq("external_place_id", externalPlaceId).maybeSingle()
  );
  return row ? rowToVenue(row) : undefined;
}

/**
 * Materializes a Google-sourced venue we've never seen before as a real (persisted) Venue
 * row with zero baseline data — it will correctly compute as DIRECTORY coverage (see
 * lib/venues/coverageState.ts) rather than fabricating a score. Idempotent on
 * externalPlaceId so searching the same place twice doesn't create duplicates (checked at
 * the app layer rather than a DB-level upsert, since external_place_id has no unique
 * constraint in the schema).
 */
export async function upsertDirectoryVenueFromExternal(fields: {
  externalPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  timezone: string;
  venueType: Venue["venueType"];
  hours: NewVenueHoursInput[];
  businessStatus: Venue["businessStatus"];
  priceLevel: Venue["priceLevel"] | null;
  externalRating: number | null;
  externalRatingCount: number | null;
  website: string | null;
}): Promise<Venue> {
  const existing = await getVenueByExternalPlaceId(fields.externalPlaceId);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const row = unwrap(
    await supabaseAdmin()
      .from("venues")
      .insert({
        external_place_id: fields.externalPlaceId,
        name: fields.name,
        slug: `${fields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${id.slice(0, 6)}`,
        category: "Nightlife",
        subcategory: null,
        venue_type: fields.venueType,
        neighborhood: fields.city,
        street_address: fields.streetAddress,
        city: fields.city,
        state: fields.state,
        postal_code: fields.postalCode,
        latitude: fields.latitude,
        longitude: fields.longitude,
        timezone: fields.timezone,
        website: fields.website,
        instagram_handle: null,
        capacity_estimate: null,
        price_level: fields.priceLevel ?? 2,
        music_type: null,
        is_active: true,
        business_status: fields.businessStatus,
        external_rating: fields.externalRating,
        external_rating_count: fields.externalRatingCount,
        claim_status: "UNCLAIMED",
      })
      .select()
      .single()
  );
  await replaceHours(row.id, fields.hours);
  return (await getVenueById(row.id))!;
}

export async function listVenuesInBounds(box: BoundingBox): Promise<Venue[]> {
  const venues = await listVenues();
  return venues.filter((v) => isWithinBoundingBox({ lat: v.latitude, lng: v.longitude }, box));
}

export async function searchVenues(query: string): Promise<Venue[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[%_]/g, "\\$&");
  const qLower = q.toLowerCase();

  const orParts = [
    `name.ilike.%${escaped}%`,
    `neighborhood.ilike.%${escaped}%`,
    `category.ilike.%${escaped}%`,
    `music_type.ilike.%${escaped}%`,
  ];

  // venue_type is a Postgres enum column — ilike (~~*) has no defined operator for enums,
  // and PostgREST's .or() logic-tree parser rejects a ::text cast inline too (tried both;
  // both failed against the real database, only surfaced once the search bar was actually
  // exercised against Supabase for the first time). Since it's a small fixed set, match it
  // by resolving the query to a known type/label and using an exact eq() instead — loses
  // substring matching on this one field (typing "cl" won't match CLUB), but that's an
  // honest tradeoff for a filter that was never going to be free-text on an enum anyway.
  const matchedType = (Object.keys(VENUE_TYPE_LABELS) as VenueType[]).find(
    (t) => t.toLowerCase() === qLower || VENUE_TYPE_LABELS[t].toLowerCase() === qLower
  );
  if (matchedType) orParts.push(`venue_type.eq.${matchedType}`);

  const rows = unwrap(
    await supabaseAdmin().from("venues").select(VENUE_SELECT).eq("is_active", true).or(orParts.join(","))
  );
  return rows.map(rowToVenue);
}

// ---------------- reports ----------------

export async function listReportsForVenue(venueId: string): Promise<VenueReport[]> {
  const rows = unwrap(await supabaseAdmin().from("venue_reports").select().eq("venue_id", venueId));
  return rows.map(rowToReport);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

const PAGE_SIZE = 1000;
// Capped rather than firing every remaining page at once: an uncapped Promise.all here (one
// version of this function actually shipped that way) produced silently incomplete results
// under load in production — plausibly a Supabase/PostgREST connection-pool limit rejecting
// or truncating some of 20+ truly-simultaneous requests without surfacing as a hard error.
// Never fully root-caused; capped concurrency plus the hard count check below are the
// defense regardless of the exact mechanism.
const MAX_CONCURRENT_PAGES = 5;

/**
 * PostgREST caps a single response at a server-side max-rows limit (Supabase's default is
 * 1000) regardless of the query itself — a batched query spanning many venues can trivially
 * exceed that (151 venues x 168 hourly-baseline rows each is ~25k rows) and silently
 * truncate rather than error, which is far worse than a visible failure: every venue whose
 * rows fell outside the first page looked like it had zero data. Found in production after
 * adding real venues pushed the total row count over the threshold for the first time.
 *
 * The first fix paginated with .range() in a fully sequential loop — correct, but 23.5k
 * baseline rows is ~24 pages awaited one at a time, which turned into the next production
 * regression (a 140-venue map load going from ~2s to ~10s+). An uncapped-concurrency version
 * (fire every remaining page via one Promise.all) fixed the latency but reintroduced
 * silent data loss under real load — worse than either prior version, since it looked fast
 * *and* wrong. This version fetches page 1 (which also returns the true total row count, via
 * `{count: "exact"}` on the caller's .select()), then works through the rest in capped
 * batches, and hard-fails if the final tally doesn't match the count PostgREST itself
 * reported — silent truncation must never again just look like "this venue has no data."
 */
async function fetchAllRows(
  page: (
    from: number,
    to: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => PromiseLike<{ data: any; error: any; count?: number | null }>
): Promise<Row[]> {
  const first = await page(0, PAGE_SIZE - 1);
  const firstRows: Row[] = unwrap(first);
  const total = first.count;

  // A short page proves there's no more data, regardless of whether count came back.
  if (firstRows.length < PAGE_SIZE) {
    return firstRows;
  }
  // A full page with no readable total is NOT proof there's no more data — it just means
  // we can't tell. Guessing "done" here previously caused a silent under-fetch whenever
  // PostgREST returned a full page without a usable Content-Range count under load.
  if (total == null) {
    throw new Error("fetchAllRows: got a full page but no total count back — cannot determine if more data exists.");
  }
  if (total <= PAGE_SIZE) {
    return firstRows;
  }

  const offsets: number[] = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset);

  const all = firstRows.slice();
  for (let i = 0; i < offsets.length; i += MAX_CONCURRENT_PAGES) {
    const chunk = offsets.slice(i, i + MAX_CONCURRENT_PAGES);
    const results = await Promise.all(chunk.map((offset) => page(offset, offset + PAGE_SIZE - 1).then((r) => unwrap(r))));
    for (const rows of results) all.push(...rows);
  }

  if (all.length !== total) {
    throw new Error(`fetchAllRows: expected ${total} rows but got ${all.length} — a page silently returned incomplete data.`);
  }
  return all;
}

/** Batched sibling of listReportsForVenue — one round-trip for N venues instead of N.
 * Used by computeVenueStatesBatch (composeVenue.ts) for map/list views, where scoring every
 * visible venue with N separate per-venue queries each would multiply real network latency
 * by however many venues are on screen. */
export async function listReportsForVenues(venueIds: string[]): Promise<Map<string, VenueReport[]>> {
  if (venueIds.length === 0) return new Map();
  const rows = await fetchAllRows((from, to) =>
    supabaseAdmin().from("venue_reports").select("*", { count: "exact" }).in("venue_id", venueIds).range(from, to)
  );
  return groupBy(rows.map(rowToReport), (r) => r.venueId);
}

export async function getLastReportByUserForVenue(userId: string, venueId: string): Promise<VenueReport | undefined> {
  const row = unwrap(
    await supabaseAdmin()
      .from("venue_reports")
      .select()
      .eq("user_id", userId)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return row ? rowToReport(row) : undefined;
}

/** `createdAt` is optional and meant only for backdating simulated/demo reports (real
 * submissions always omit it, letting Postgres's own now() default apply) — previously
 * simulateReportsForVenue computed a backdated age that this function silently discarded,
 * so every simulated report landed at the real submission instant instead of its intended
 * age. Explicitly setting it here lets the venue_reports_set_cooldown_window trigger
 * recompute cooldown_window from the real value, exactly as it does for a normal insert. */
export async function createReport(fields: Omit<VenueReport, "id" | "createdAt"> & { createdAt?: string }): Promise<VenueReport> {
  const row = unwrap(
    await supabaseAdmin()
      .from("venue_reports")
      .insert({
        venue_id: fields.venueId,
        user_id: fields.userId,
        crowd_level: fields.crowdLevel,
        wait_level: fields.waitLevel,
        energy_level: fields.energyLevel,
        crowd_note: fields.crowdNote,
        report_source: fields.reportSource,
        is_verified_nearby: fields.isVerifiedNearby,
        trust_weight_at_submission: fields.trustWeightAtSubmission,
        ...(fields.createdAt ? { created_at: fields.createdAt } : {}),
      })
      .select()
      .single()
  );
  return rowToReport(row);
}

export async function flagReport(reportId: string, flaggedBy: string, reason: string): Promise<void> {
  unwrap(await supabaseAdmin().from("report_flags").insert({ report_id: reportId, flagged_by: flaggedBy, reason }));
}

export async function getReportById(id: string): Promise<VenueReport | undefined> {
  const row = unwrap(await supabaseAdmin().from("venue_reports").select().eq("id", id).maybeSingle());
  return row ? rowToReport(row) : undefined;
}

/** Dev/demo-only: backdates an existing report's created_at so the delayed-confirmation
 * demo trigger (/api/dev/simulate-confirmation) doesn't require waiting out the real
 * 20-45 minute window. Never called from any real user-facing flow. */
export async function backdateReportForDemo(id: string, createdAtIso: string): Promise<void> {
  unwrap(await supabaseAdmin().from("venue_reports").update({ created_at: createdAtIso }).eq("id", id));
}

/** Takes an hours-ago window (not a timestamp) so the "now" it's relative to is computed
 * here, in a plain function — not inline in a Server Component's render body, where React's
 * purity rule flags a direct Date.now() call. */
export async function countReportsInLastHours(hours: number): Promise<number> {
  const sinceIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("venue_reports")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return count ?? 0;
}

/** Used to decide the FIRST_REPORT_TONIGHT XP bonus — checked BEFORE the new report is
 * created, so the new report itself never counts as its own prior "someone already
 * reported tonight" evidence. */
export async function hasReportSinceForVenue(venueId: string, sinceIso: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from("venue_reports")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .gte("created_at", sinceIso);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function recentReportValuesByUser(userId: string, limit = 6): Promise<string[]> {
  const rows: Row[] = unwrap(
    await supabaseAdmin()
      .from("venue_reports")
      .select("crowd_level, wait_level, energy_level")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
  );
  return rows.map((r) => `${r.crowd_level}:${r.wait_level}:${r.energy_level}`);
}

// ---------------- baselines & events ----------------

export async function listBaselinesForVenue(venueId: string): Promise<VenueHourlyBaseline[]> {
  const rows = unwrap(await supabaseAdmin().from("venue_hourly_baselines").select().eq("venue_id", venueId));
  return rows.map(rowToBaseline);
}

export async function listBaselinesForVenues(venueIds: string[]): Promise<Map<string, VenueHourlyBaseline[]>> {
  if (venueIds.length === 0) return new Map();
  // The one most likely to actually exceed PAGE_SIZE: up to 168 rows per venue (7 days x
  // 24 hours), so this hits 1000 rows at only ~6 venues in the batch.
  const rows = await fetchAllRows((from, to) =>
    supabaseAdmin().from("venue_hourly_baselines").select("*", { count: "exact" }).in("venue_id", venueIds).range(from, to)
  );
  return groupBy(rows.map(rowToBaseline), (b) => b.venueId);
}

export async function listEventsForVenue(venueId: string): Promise<VenueEvent[]> {
  const rows = unwrap(await supabaseAdmin().from("venue_events").select().eq("venue_id", venueId));
  return rows.map(rowToEvent);
}

export async function listEventsForVenues(venueIds: string[]): Promise<Map<string, VenueEvent[]>> {
  if (venueIds.length === 0) return new Map();
  const rows = await fetchAllRows((from, to) =>
    supabaseAdmin().from("venue_events").select("*", { count: "exact" }).in("venue_id", venueIds).range(from, to)
  );
  return groupBy(rows.map(rowToEvent), (e) => e.venueId);
}

// ---------------- special hours ----------------
// A separate bounded query (a narrow date window around "now"), not embedded into
// VENUE_SELECT/Venue — special hours are rare (most venues have none) and open-ended in
// time, so folding them into every venue fetch would cost every caller of listVenues()/
// getVenueById() a join they almost never need. Only the hours-status computation path
// (composeVenue.ts) fetches these.

/** today-1 to today+13 in UTC-date terms is a generous enough window that a venue in any
 * real timezone still has "today" and "yesterday" (needed by buildEffectiveHours) plus
 * two weeks of upcoming special dates (needed by getVenueOpenStatus's forward scan)
 * covered without a per-venue-timezone-aware query. */
function specialHoursDateWindow(now: Date): { from: string; to: string } {
  const from = new Date(now.getTime() - 24 * 3_600_000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 13 * 24 * 3_600_000).toISOString().slice(0, 10);
  return { from, to };
}

export async function listSpecialHoursForVenue(venueId: string, now: Date = new Date()): Promise<VenueSpecialHours[]> {
  const { from, to } = specialHoursDateWindow(now);
  const rows = unwrap(
    await supabaseAdmin()
      .from("venue_special_hours")
      .select()
      .eq("venue_id", venueId)
      .gte("special_date", from)
      .lte("special_date", to)
  );
  return rows.map(rowToSpecialHours);
}

export async function listSpecialHoursForVenues(venueIds: string[], now: Date = new Date()): Promise<Map<string, VenueSpecialHours[]>> {
  if (venueIds.length === 0) return new Map();
  const { from, to } = specialHoursDateWindow(now);
  const rows = await fetchAllRows((rangeFrom, rangeTo) =>
    supabaseAdmin()
      .from("venue_special_hours")
      .select("*", { count: "exact" })
      .in("venue_id", venueIds)
      .gte("special_date", from)
      .lte("special_date", to)
      .range(rangeFrom, rangeTo)
  );
  return groupBy(rows.map(rowToSpecialHours), (s) => s.venueId);
}

// ---------------- signal snapshots ----------------

export async function listSnapshotHistory(venueId: string, sinceMinutesAgo = 240): Promise<VenueSignalSnapshot[]> {
  const cutoff = new Date(Date.now() - sinceMinutesAgo * 60_000).toISOString();
  const rows = unwrap(
    await supabaseAdmin().from("venue_signal_snapshots").select().eq("venue_id", venueId).gte("captured_at", cutoff)
  );
  return rows.map(rowToSnapshot);
}

export async function listSnapshotHistoryForVenues(
  venueIds: string[],
  sinceMinutesAgo = 240
): Promise<Map<string, VenueSignalSnapshot[]>> {
  if (venueIds.length === 0) return new Map();
  const cutoff = new Date(Date.now() - sinceMinutesAgo * 60_000).toISOString();
  const rows = await fetchAllRows((from, to) =>
    supabaseAdmin()
      .from("venue_signal_snapshots")
      .select("*", { count: "exact" })
      .in("venue_id", venueIds)
      .gte("captured_at", cutoff)
      .range(from, to)
  );
  return groupBy(rows.map(rowToSnapshot), (s) => s.venueId);
}

const SIGNAL_VERSION = 1;

function snapshotInsertRow(venueId: string, result: PulseResult): Row {
  const componentValue = (key: string) => result.components.find((c) => c.key === key)?.value ?? 0;
  return {
    venue_id: venueId,
    pulse_score: result.pulseScore,
    confidence_score: result.confidenceScore,
    crowd_score: componentValue("liveReports"),
    trend_score: componentValue("trend"),
    report_score: componentValue("liveReports"),
    historical_score: componentValue("historical"),
    event_score: componentValue("event"),
    friend_activity_score: componentValue("friends"),
    trend_direction: result.trend,
    wait_min_minutes: result.waitEstimate?.minMinutes ?? null,
    wait_max_minutes: result.waitEstimate?.maxMinutes ?? null,
    expected_peak_start: result.expectedPeak?.start ?? null,
    expected_peak_end: result.expectedPeak?.end ?? null,
    signal_version: SIGNAL_VERSION,
  };
}

export async function appendSnapshot(venueId: string, result: PulseResult): Promise<VenueSignalSnapshot> {
  const row = unwrap(
    await supabaseAdmin().from("venue_signal_snapshots").insert(snapshotInsertRow(venueId, result)).select().single()
  );

  // Keep the history bounded so the table doesn't grow forever during a long-running deploy.
  const cutoff = new Date(Date.now() - 12 * 3_600_000).toISOString();
  unwrap(await supabaseAdmin().from("venue_signal_snapshots").delete().eq("venue_id", venueId).lt("captured_at", cutoff));

  return rowToSnapshot(row);
}

/** Batched sibling of appendSnapshot — one insert (+ one prune) for N venues instead of 2N.
 * Used by computeVenueStatesBatch for map/list views; the per-venue pruning delete is safe
 * to run scoped only to the venues in this batch (`.in("venue_id", venueIds)`) since venues
 * outside the batch aren't touched by this call at all. */
export async function appendSnapshotsBatch(entries: Array<{ venueId: string; result: PulseResult }>): Promise<void> {
  if (entries.length === 0) return;
  unwrap(
    await supabaseAdmin()
      .from("venue_signal_snapshots")
      .insert(entries.map((e) => snapshotInsertRow(e.venueId, e.result)))
  );

  const cutoff = new Date(Date.now() - 12 * 3_600_000).toISOString();
  unwrap(
    await supabaseAdmin()
      .from("venue_signal_snapshots")
      .delete()
      .in(
        "venue_id",
        entries.map((e) => e.venueId)
      )
      .lt("captured_at", cutoff)
  );
}

// ---------------- historical rollups ----------------
// venue_signal_snapshots is deliberately pruned after 12h (see appendSnapshot(sBatch)
// above) — these functions are the durable archive on the other side of that pruning.
// Written only by the request-triggered compute-on-read path in
// lib/pulse/history/nightlyRollup.ts (no cron infra exists in this app).

const ROLLUP_HISTORY_LOOKBACK_DAYS = 70;

export async function listRecentRollupsForVenue(venueId: string, now: Date = new Date()): Promise<VenueNightlyRollup[]> {
  const cutoff = new Date(now.getTime() - ROLLUP_HISTORY_LOOKBACK_DAYS * 24 * 3_600_000).toISOString().slice(0, 10);
  const rows = unwrap(
    await supabaseAdmin()
      .from("venue_nightly_rollups")
      .select()
      .eq("venue_id", venueId)
      .gte("nightlife_date", cutoff)
      .order("nightlife_date", { ascending: false })
  );
  return rows.map(rowToNightlyRollup);
}

/** Batched sibling of listRecentRollupsForVenue — one round-trip for N venues instead of N. */
export async function listRecentRollupsForVenues(venueIds: string[], now: Date = new Date()): Promise<Map<string, VenueNightlyRollup[]>> {
  if (venueIds.length === 0) return new Map();
  const cutoff = new Date(now.getTime() - ROLLUP_HISTORY_LOOKBACK_DAYS * 24 * 3_600_000).toISOString().slice(0, 10);
  const rows = await fetchAllRows((from, to) =>
    supabaseAdmin()
      .from("venue_nightly_rollups")
      .select("*", { count: "exact" })
      .in("venue_id", venueIds)
      .gte("nightlife_date", cutoff)
      .range(from, to)
  );
  return groupBy(rows.map(rowToNightlyRollup), (r) => r.venueId);
}

/** venue_ids that do NOT yet have a rollup row for `nightlifeDate` — the cheap check
 * that keeps finalizeNightlyRollupsIfNeeded's common case (nothing to do) to one query. */
export async function getMissingRollupVenueIds(venueIds: string[], nightlifeDate: string): Promise<Set<string>> {
  if (venueIds.length === 0) return new Set();
  const rows: Row[] = unwrap(
    await supabaseAdmin().from("venue_nightly_rollups").select("venue_id").in("venue_id", venueIds).eq("nightlife_date", nightlifeDate)
  );
  const existing = new Set(rows.map((r) => r.venue_id));
  return new Set(venueIds.filter((id) => !existing.has(id)));
}

async function listSnapshotsInWindow(venueId: string, from: Date, to: Date): Promise<VenueSignalSnapshot[]> {
  const rows = unwrap(
    await supabaseAdmin()
      .from("venue_signal_snapshots")
      .select()
      .eq("venue_id", venueId)
      .gte("captured_at", from.toISOString())
      .lt("captured_at", to.toISOString())
  );
  return rows.map(rowToSnapshot);
}

async function countReportsInWindow(venueId: string, from: Date, to: Date): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("venue_reports")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return count ?? 0;
}

/** Folds this venue's still-live snapshots + report count for one completed nightlife-
 * night into a single durable rollup row. Never inserts when there's no real data
 * (sample_count 0) — a fabricated zero-row would silently corrupt later "vs typical"
 * averages. Idempotent: a 23505 (another concurrent request finalized the same night
 * first) is swallowed, not thrown — the row existing is all this function promises. */
export async function computeAndInsertNightlyRollup(
  venueId: string,
  nightlifeDate: string,
  nightlifeDayOfWeek: number,
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  const [snapshots, reportCount] = await Promise.all([
    listSnapshotsInWindow(venueId, windowStart, windowEnd),
    countReportsInWindow(venueId, windowStart, windowEnd),
  ]);
  if (snapshots.length === 0) return;

  const avgPulseScore = snapshots.reduce((sum, s) => sum + s.pulseScore, 0) / snapshots.length;
  const peak = snapshots.reduce((best, s) => (s.pulseScore > best.pulseScore ? s : best));

  const { error } = await supabaseAdmin()
    .from("venue_nightly_rollups")
    .insert({
      venue_id: venueId,
      nightlife_date: nightlifeDate,
      nightlife_day_of_week: nightlifeDayOfWeek,
      avg_pulse_score: avgPulseScore,
      peak_pulse_score: peak.pulseScore,
      peak_at: peak.capturedAt,
      sample_count: snapshots.length,
      report_count: reportCount,
    });
  if (error && error.code !== "23505") throw new Error(`Supabase error: ${error.message}`);
}

// ---------------- saved venues ----------------

export async function listSavedVenueIds(userId: string): Promise<Set<string>> {
  const rows: Row[] = unwrap(await supabaseAdmin().from("saved_venues").select("venue_id").eq("user_id", userId));
  return new Set(rows.map((r) => r.venue_id));
}

export async function toggleSaved(userId: string, venueId: string): Promise<boolean> {
  const { data: existing } = await supabaseAdmin()
    .from("saved_venues")
    .select()
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (existing) {
    unwrap(await supabaseAdmin().from("saved_venues").delete().eq("user_id", userId).eq("venue_id", venueId));
    return false;
  }
  unwrap(await supabaseAdmin().from("saved_venues").insert({ user_id: userId, venue_id: venueId }));
  return true;
}
