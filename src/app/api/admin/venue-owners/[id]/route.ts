import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { setOwnershipRequestStatus } from "@/lib/data/ownership";

const schema = z.object({ status: z.enum(["VERIFIED", "REJECTED", "REVOKED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const updated = await setOwnershipRequestStatus(id, parsed.data.status, session.profile.id);
  if (!updated) return NextResponse.json({ error: "Claim request not found" }, { status: 404 });

  return NextResponse.json({ ok: true, request: updated });
}
