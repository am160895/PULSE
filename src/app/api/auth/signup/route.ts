import { NextResponse } from "next/server";
import { signup } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await signup(body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Session cookies are already set as a side effect of signup()'s signInWithPassword()
  // call — see the comment in api/auth/login/route.ts for why no manual cookie write is
  // needed here.
  return NextResponse.json({ ok: true });
}
