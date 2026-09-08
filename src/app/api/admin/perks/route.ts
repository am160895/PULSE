import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { createPerkAdmin, listAllPerksAdmin } from "@/lib/data/perks";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  return NextResponse.json({ perks: await listAllPerksAdmin() });
}

const perkSchema = z.object({
  venueId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  requiredMinXp: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = perkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid perk data" }, { status: 400 });
  }

  const perk = await createPerkAdmin(parsed.data, session.profile.id);
  return NextResponse.json({ ok: true, perk }, { status: 201 });
}
