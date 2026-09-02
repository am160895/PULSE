import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { createVenueAdmin, listAllVenuesForAdmin } from "@/lib/data/repository";
import { venueAdminSchema } from "@/lib/venues/adminSchema";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  return NextResponse.json({ venues: await listAllVenuesForAdmin() });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = venueAdminSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid venue data" }, { status: 400 });
  }

  const data = parsed.data;

  // The bulk importer has always guarded against re-adding a venue that's already in the
  // system (see import/route.ts) — hand-entering one venue at a time through this form had
  // no equivalent check at all, so the same "Django" could get created twice with nobody
  // told until two markers showed up on top of each other on the map.
  const isDuplicateName = (await listAllVenuesForAdmin()).some(
    (v) => v.name.trim().toLowerCase() === data.name.trim().toLowerCase()
  );
  if (isDuplicateName) {
    return NextResponse.json({ error: `A venue named "${data.name}" already exists.` }, { status: 409 });
  }

  const venue = await createVenueAdmin({
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

  return NextResponse.json({ ok: true, venue }, { status: 201 });
}
