import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import WebSocket from "ws";

/**
 * Request-scoped client bound to this request's cookies, used only for auth
 * (signUp/signInWithPassword/signOut/getUser) — never for data reads/writes, which always
 * go through supabaseAdmin(). Must be created fresh per request (not cached like the admin
 * client) since it carries this request's specific cookie jar.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see README §15."
    );
  }

  return createServerClient(url, anonKey, {
    // See admin.ts — Node 20 has no global WebSocket, which supabase-js's eagerly-constructed
    // Realtime client needs even though this app never opens a realtime subscription.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (no response to attach Set-Cookie to) —
          // proxy.ts's session refresh covers the write path in that case instead.
        }
      },
    },
  });
}
