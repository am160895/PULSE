import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { blockProfile, getProfileById } from "@/lib/data/social";

const schema = z.object({ profileId: z.string() });

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (!(await getProfileById(parsed.data.profileId))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const friendship = await blockProfile(session.profile.id, parsed.data.profileId);
  return NextResponse.json({ ok: true, friendship });
}
