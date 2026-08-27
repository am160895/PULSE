import { NextResponse } from "next/server";
import { z } from "zod";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { createFriendRequest, getProfileByUsername } from "@/lib/data/social";

const schema = z.object({ username: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a username" }, { status: 400 });

  const target = await getProfileByUsername(parsed.data.username);
  if (!target) return NextResponse.json({ error: "No user with that username" }, { status: 404 });

  const result = await createFriendRequest(session.profile.id, target.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, friendship: result });
}
