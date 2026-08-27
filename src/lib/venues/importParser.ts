// Pure parsing for the admin bulk-import feature (paste-list + CSV) — no Supabase, no
// network, fully unit-testable per this app's established test convention. Deliberately
// permissive here: venueType/neighborhood/etc. are extracted as raw strings and left for
// the EXISTING venueAdminSchema (lib/venues/adminSchema.ts) to validate downstream, once
// geocoding has resolved coordinates — this module's only job is "did the row parse into
// the right shape," not "is this a real venue type."

export interface ImportHoursWindow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface ImportSourceRow {
  /** 1-indexed — for paste mode, the line number; for CSV, the data row number (header
   * excluded), matching what an admin counting lines in their own file would expect. */
  row: number;
  name: string;
  address: string;
  /** Raw, uppercased — validated against the real VenueType enum by venueAdminSchema
   * downstream, not here. */
  venueType: string;
  neighborhood: string;
  website: string | null;
  instagramHandle: string | null;
  /** null means "not supplied" — the caller applies the default (2), never fabricated here. */
  priceLevel: number | null;
  musicType: string | null;
  hours: ImportHoursWindow[];
}

export interface ImportParseIssue {
  row: number;
  detail: string;
}

export interface ImportParseResult {
  rows: ImportSourceRow[];
  issues: ImportParseIssue[];
}

const DAY_COLUMNS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // dayOfWeek 0-6, matches VenueForm.tsx's own DAY_LABELS ordering

/** One venue per line: `Name | Address | Venue Type | Neighborhood`. Blank lines are
 * skipped silently (normal textarea trailing-newline noise, not a data error). */
export function parsePasteImport(raw: string): ImportParseResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: ImportSourceRow[] = [];
  const issues: ImportParseIssue[] = [];

  lines.forEach((line, i) => {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4 || parts.slice(0, 4).some((p) => !p)) {
      issues.push({ row: i + 1, detail: "Expected: Name | Address | Venue Type | Neighborhood" });
      return;
    }
    const [name, address, venueType, neighborhood] = parts;
    rows.push({
      row: i + 1,
      name,
      address,
      venueType: venueType.toUpperCase(),
      neighborhood,
      website: null,
      instagramHandle: null,
      priceLevel: null,
      musicType: null,
      hours: [],
    });
  });

  return { rows, issues };
}

/** Hand-rolled RFC4180-ish line parser (quoted fields, embedded commas, "" for a literal
 * quote) — no new npm dependency. Known, accepted limitation: a quoted field containing an
 * embedded newline will NOT parse correctly, since rows are split on newlines first. Real
 * venue names/addresses don't contain embedded newlines, so this is a deliberate scope
 * limit, not an oversight. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export const CSV_TEMPLATE_HEADER =
  "name,address,venueType,neighborhood,website,instagramHandle,priceLevel,musicType," +
  DAY_COLUMNS.flatMap((d) => [`${d}_open`, `${d}_close`]).join(",");

/** Header row is required, column order doesn't matter (matched by name, case-insensitive).
 * Required columns: name, address. Everything else is optional — defaults are applied by
 * the caller, never here. A blank open/close pair for a day means "closed that day," not
 * "unknown" — omit the columns entirely if hours aren't known yet. */
export function parseCsvImport(raw: string): ImportParseResult {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], issues: [] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const nameCol = col("name");
  const addressCol = col("address");
  if (nameCol === -1 || addressCol === -1) {
    return { rows: [], issues: [{ row: 0, detail: "CSV must have a header row with at least 'name' and 'address' columns" }] };
  }

  const rows: ImportSourceRow[] = [];
  const issues: ImportParseIssue[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const get = (name: string) => {
      const c = col(name);
      return c === -1 ? "" : (fields[c] ?? "").trim();
    };

    const name = get("name");
    const address = get("address");
    if (!name || !address) {
      issues.push({ row: i, detail: "Missing name or address" });
      continue;
    }

    const hours: ImportHoursWindow[] = [];
    DAY_COLUMNS.forEach((day, dayOfWeek) => {
      const openTime = get(`${day}_open`);
      const closeTime = get(`${day}_close`);
      if (openTime && closeTime) hours.push({ dayOfWeek, openTime, closeTime });
    });

    const priceLevelRaw = get("pricelevel");
    const priceLevelNum = priceLevelRaw ? Number(priceLevelRaw) : null;

    rows.push({
      row: i,
      name,
      address,
      venueType: get("venuetype").toUpperCase(),
      neighborhood: get("neighborhood"),
      website: get("website") || null,
      instagramHandle: get("instagramhandle") || null,
      priceLevel: priceLevelNum && priceLevelNum >= 1 && priceLevelNum <= 4 ? priceLevelNum : null,
      musicType: get("musictype") || null,
      hours,
    });
  }

  return { rows, issues };
}

/** Same defaults VenueForm.tsx's own manual-entry form already applies when a field isn't
 * supplied — kept in one place so the import path and the manual-entry path never drift
 * apart on what "reasonable default" means for this app's NYC-only venue set. */
export function applyImportDefaults(row: ImportSourceRow, coords: { lat: number; lng: number }) {
  return {
    name: row.name,
    category: "Nightlife",
    subcategory: null as string | null,
    venueType: row.venueType,
    neighborhood: row.neighborhood,
    streetAddress: row.address,
    city: "New York",
    state: "NY",
    postalCode: "",
    latitude: coords.lat,
    longitude: coords.lng,
    timezone: "America/New_York",
    website: row.website,
    instagramHandle: row.instagramHandle,
    capacityEstimate: null as number | null,
    priceLevel: row.priceLevel ?? 2,
    musicType: row.musicType,
    isActive: true,
    hours: row.hours,
  };
}
