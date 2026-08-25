import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById, toggleSaved } from "@/lib/data/repository";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: venueId } = await params;
  if (!(await getVenueById(venueId))) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const isSaved = await toggleSaved(session.profile.id, venueId);
  return NextResponse.json({ ok: true, isSaved });
}
