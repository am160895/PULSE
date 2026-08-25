import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// No generated Database type exists for this schema, so the client is typed loosely (any)
// rather than inferring `never` for every insert/update/select shape, which is what
// supabase-js's generics default to without one. Runtime behavior is unaffected either way —
// this only changes what TypeScript checks at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient<any, any, any>>;

declare global {
  var __pulseSupabaseAdmin: AnyClient | undefined;
}

/**
 * Service-role client, used for every data read/write in repository.ts and social.ts.
 * This bypasses RLS entirely — authorization is enforced at the API-route layer (session +
 * role checks), same convention the local dev data layer used. The SQL migration's RLS
 * policies are a defense-in-depth backstop for the day a client talks to Supabase directly,
 * not the primary enforcement mechanism today. Never import this into client-side code —
 * the service role key must never reach the browser.
 */
export function supabaseAdmin() {
  if (!globalThis.__pulseSupabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see README §15."
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.__pulseSupabaseAdmin = createClient<any, any, any>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      // supabase-js eagerly constructs a Realtime client (even though this app never opens
      // a realtime subscription — everything polls instead), which needs a WebSocket
      // constructor. Node 20 has no global WebSocket (added in Node 22); `ws` supplies one
      // so client construction itself doesn't crash on this Node version.
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    });
  }
  return globalThis.__pulseSupabaseAdmin;
}
