import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { deleteVenueAdmin, getVenueById, updateVenueAdmin } from "@/lib/data/repository";
import { venueAdminPatchSchema } from "@/lib/venues/adminSchema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  return NextResponse.json({ venue });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  if (!(await getVenueById(id))) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const parsed = venueAdminPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid venue data" }, { status: 400 });
  }

  const data = parsed.data;
  const venue = await updateVenueAdmin(id, {
    ...data,
    website: data.website === "" ? null : data.website,
  });

  return NextResponse.json({ ok: true, venue });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const deleted = await deleteVenueAdmin(id);
  if (!deleted) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
