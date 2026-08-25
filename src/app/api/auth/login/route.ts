import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await login(body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // Session cookies are already set as a side effect of login()'s supabaseServer() call —
  // its cookie adapter writes through next/headers' cookies(), which a Route Handler is
  // allowed to mutate, and those writes are reflected on this response automatically.
  return NextResponse.json({ ok: true });
}
