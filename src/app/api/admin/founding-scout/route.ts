import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { getFoundingScoutConfig, updateFoundingScoutConfig } from "@/lib/data/gamification";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  return NextResponse.json({ config: await getFoundingScoutConfig() });
}

const schema = z.object({
  enabled: z.boolean().optional(),
  maxCount: z.number().int().min(0).max(100_000).optional(),
});

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const config = await updateFoundingScoutConfig(parsed.data);
  return NextResponse.json({ ok: true, config });
}
