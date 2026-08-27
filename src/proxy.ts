import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import WebSocket from "ws";

const PUBLIC_PREFIXES = ["/login", "/signup", "/api/auth", "/manifest", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Supabase's session is a short-lived JWT plus a refresh token; this refresh has to
  // happen on every request or sessions silently expire mid-visit. next() is rebuilt after
  // every cookie write (not just returned once) because a response created before a cookie
  // write won't carry it — see Supabase's own Next.js proxy/middleware guide.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // See src/lib/supabase/admin.ts — Node 20 has no global WebSocket, which supabase-js's
      // eagerly-constructed Realtime client needs even though this app never opens a
      // realtime subscription.
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Anonymous browsing: mint a session-less visitor an anonymous Supabase Auth session
    // (a real profiles row gets auto-provisioned for it — see getCurrentSession()) rather
    // than forcing login just to view the map. Restricted to top-level navigations
    // (Sec-Fetch-Mode: navigate) — a fresh browser's first pageload fires several
    // concurrent requests before any of them has a cookie yet; minting on every one of
    // those would create a separate orphaned anonymous identity per request, with only one
    // winning the cookie jar. Letting only the navigation mint a session means the others
    // just fall back to today's redirect/401 until the navigation's cookie lands and a
    // refetch picks it up.
    if (request.headers.get("sec-fetch-mode") === "navigate") {
      const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
      // Falls through to `return response` below on success — signInAnonymously() drives
      // the same setAll() cookie-writing path as a token refresh, so `response` already
      // carries the new session's Set-Cookie by the time we return it.
      if (!anonError && anon.user) return response;
      // Anonymous sign-ins disabled in the Supabase project (or some other failure) — fall
      // through to the pre-existing login-required behavior below rather than breaking.
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
