import { NextResponse } from "next/server";
import { z } from "zod";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { getProfileById, setCloseFriend } from "@/lib/data/social";

const schema = z.object({ profileId: z.string(), isClose: z.boolean() });

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (parsed.data.isClose && !(await getProfileById(parsed.data.profileId))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await setCloseFriend(session.profile.id, parsed.data.profileId, parsed.data.isClose);
  return NextResponse.json({ ok: true });
}
