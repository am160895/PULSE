import { NextResponse } from "next/server";
import { z } from "zod";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { respondToFriendRequest } from "@/lib/data/social";

const schema = z.object({ friendshipId: z.string(), accept: z.boolean() });

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await respondToFriendRequest(parsed.data.friendshipId, session.profile.id, parsed.data.accept);
  if ("error" in result) {
    const status = result.error === "Request not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, friendship: result });
}
