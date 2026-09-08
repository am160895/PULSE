import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { deletePerkAdmin, updatePerkAdmin } from "@/lib/data/perks";

const perkPatchSchema = z.object({
  venueId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  requiredMinXp: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const parsed = perkPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid perk data" }, { status: 400 });
  }

  const perk = await updatePerkAdmin(id, parsed.data);
  if (!perk) return NextResponse.json({ error: "Perk not found" }, { status: 404 });
  return NextResponse.json({ ok: true, perk });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const deleted = await deletePerkAdmin(id);
  if (!deleted) return NextResponse.json({ error: "Perk not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
