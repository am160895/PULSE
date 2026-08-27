import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { createVenueAdmin, listAllVenuesForAdmin } from "@/lib/data/repository";
import { venueAdminSchema } from "@/lib/venues/adminSchema";
import { applyImportDefaults, parseCsvImport, parsePasteImport } from "@/lib/venues/importParser";
import { geocode } from "@/lib/geo/nominatim";
import { IMPORT_MAX_ROWS } from "@/config/constants";

// Nominatim's usage policy caps requests at 1/second — rows are processed sequentially,
// not in parallel, to respect that. This app's deployment (Railway, a long-lived `next
// start` process) has no serverless-style per-request timeout, so a ~45-90s single
// request is fine; IMPORT_MAX_ROWS keeps it comfortably bounded regardless.
const NOMINATIM_DELAY_MS = 1100;

const bodySchema = z.object({
  mode: z.enum(["paste", "csv"]),
  raw: z.string().min(1),
});

type RowStatus = "added" | "skipped_duplicate" | "failed_geocode" | "invalid";
interface RowResult {
  row: number;
  name: string;
  status: RowStatus;
  detail?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { rows: sourceRows, issues: parseIssues } = (parsedBody.data.mode === "csv" ? parseCsvImport : parsePasteImport)(
    parsedBody.data.raw
  );

  if (sourceRows.length > IMPORT_MAX_ROWS) {
    return NextResponse.json(
      { error: `Import up to ${IMPORT_MAX_ROWS} venues at a time — split larger lists into multiple imports.` },
      { status: 400 }
    );
  }

  const existingNames = new Set((await listAllVenuesForAdmin()).map((v) => v.name));

  const results: RowResult[] = parseIssues.map((issue) => ({ row: issue.row, name: "", status: "invalid", detail: issue.detail }));

  for (const [index, sourceRow] of sourceRows.entries()) {
    if (existingNames.has(sourceRow.name)) {
      results.push({ row: sourceRow.row, name: sourceRow.name, status: "skipped_duplicate" });
      continue;
    }

    if (index > 0) await sleep(NOMINATIM_DELAY_MS);
    const coords = await geocode(sourceRow.address);
    if (!coords) {
      results.push({ row: sourceRow.row, name: sourceRow.name, status: "failed_geocode", detail: sourceRow.address });
      continue;
    }

    const candidate = applyImportDefaults(sourceRow, coords);
    const validated = venueAdminSchema.safeParse(candidate);
    if (!validated.success) {
      results.push({ row: sourceRow.row, name: sourceRow.name, status: "invalid", detail: validated.error.issues[0]?.message });
      continue;
    }
    const data = validated.data;

    await createVenueAdmin({
      name: data.name,
      category: data.category,
      subcategory: data.subcategory ?? null,
      venueType: data.venueType,
      neighborhood: data.neighborhood,
      streetAddress: data.streetAddress,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      website: data.website || null,
      instagramHandle: data.instagramHandle ?? null,
      capacityEstimate: data.capacityEstimate ?? null,
      priceLevel: data.priceLevel,
      musicType: data.musicType ?? null,
      isActive: data.isActive,
      hours: data.hours,
    });
    existingNames.add(sourceRow.name); // guards against duplicate names within the same submitted batch
    results.push({ row: sourceRow.row, name: sourceRow.name, status: "added" });
  }

  return NextResponse.json({ results: results.sort((a, b) => a.row - b.row) });
}
