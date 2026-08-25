import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST() {
  // signOut() clears Supabase's own session cookies via the cookie adapter — there's no
  // longer a single fixed cookie name to delete manually (Supabase splits the session
  // across multiple cookies internally).
  await logout();
  return NextResponse.json({ ok: true });
}
