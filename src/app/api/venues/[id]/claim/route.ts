import { NextResponse } from "next/server";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { getVenueById } from "@/lib/data/repository";
import { createOwnershipRequest, getOwnershipRequest, recomputeVenueClaimStatus, reviveOwnershipRequest } from "@/lib/data/ownership";

/**
 * Only ever produces a PENDING venue_owners row — never VERIFIED. Admin review
 * (PATCH /api/admin/venue-owners/[id]) is the only path to VERIFIED.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const { id } = await params;
  if (!(await getVenueById(id))) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const existing = await getOwnershipRequest(id, session.profile.id);
  if (existing) {
    if (existing.status === "PENDING" || existing.status === "VERIFIED") {
      return NextResponse.json({ ok: true, status: existing.status });
    }
    // REJECTED or REVOKED — a new claim attempt revives the same row rather than
    // silently duplicating it (the unique(venue_id, profile_id) constraint requires this).
    const revived = await reviveOwnershipRequest(existing.id);
    await recomputeVenueClaimStatus(id);
    return NextResponse.json({ ok: true, status: revived.status });
  }

  const created = await createOwnershipRequest(id, session.profile.id);
  if (!created) return NextResponse.json({ error: "A claim request already exists for this venue" }, { status: 409 });
  await recomputeVenueClaimStatus(id);
  return NextResponse.json({ ok: true, status: created.status });
}
