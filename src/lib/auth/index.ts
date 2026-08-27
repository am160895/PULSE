import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SupabaseQueryError } from "@/lib/supabase/unwrap";
import { createUserWithProfile, getProfileByAuthUserId, getProfileByUsername, provisionGuestProfile } from "@/lib/data/social";
import { listVerifiedOwnedVenueIds } from "@/lib/data/ownership";
import type { Profile } from "@/types";

export interface Session {
  userId: string;
  profile: Profile;
  /** True for an auto-provisioned anonymous browsing session (see src/proxy.ts) — a real
   * profile row exists (so every existing read path works unchanged), but every write route
   * must reject it via anonymousSessionError() below. */
  isAnonymous: boolean;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = await supabaseServer();
  // getUser() (not getSession()) revalidates the token against Supabase Auth itself rather
  // than trusting the locally-stored JWT — the right call on a server that's about to make
  // authorization decisions from the result.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  let profile = await getProfileByAuthUserId(user.id);
  if (!profile && user.is_anonymous) {
    profile = (await provisionGuestProfile(user.id)) ?? undefined;
  }
  if (!profile) return null;

  return { userId: user.id, profile, isAnonymous: !!user.is_anonymous };
}

/** Every write route gated by getCurrentSession() calls this once it sees
 * session.isAnonymous — the one place this rejection response is defined, so its shape
 * (and the "ANONYMOUS_SESSION" code the frontend keys off of to show a sign-up prompt
 * instead of a raw error) never drifts between call sites. */
export function anonymousSessionError() {
  return NextResponse.json({ error: "Create an account to do that", code: "ANONYMOUS_SESSION" }, { status: 403 });
}

/** Returns the session only if it belongs to an admin — every /admin page and
 * /api/admin/** route calls this and treats null as "not authorized," never trusting a
 * client-supplied role claim. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getCurrentSession();
  if (!session || session.profile.role !== "ADMIN") return null;
  return session;
}

export interface OwnerSession extends Session {
  /** VERIFIED-only venue ids — the resolved set every /api/owner/** route checks a
   * requested venue id against. Never widened to PENDING/REJECTED/REVOKED rows. */
  ownedVenueIds: Set<string>;
}

/** Returns null for anyone who isn't a VERIFIED owner of at least one venue. Callers
 * still must check `ownedVenueIds.has(requestedId)` for the SPECIFIC venue in the URL —
 * this only proves "owns something," not "owns this one." */
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const ownedVenueIds = await listVerifiedOwnedVenueIds(session.profile.id);
  if (ownedVenueIds.size === 0) return null;
  return { ...session, ownedVenueIds };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(60),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
});

export type SignupResult = { ok: true; userId: string } | { ok: false; error: string };

export async function signup(input: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { email, password, displayName, username } = parsed.data;

  if (await getProfileByUsername(username)) return { ok: false, error: "That username is taken" };

  // Created via the admin API (not auth.signUp) with email_confirm: true, matching this
  // app's existing zero-email-verification UX — no email sending is configured. Immediately
  // followed by signInWithPassword below to actually establish the session cookies.
  const { data: created, error: createErr } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? "Could not create account" };
  }

  try {
    await createUserWithProfile({ authUserId: created.user.id, email, username, displayName, homeCity: "New York City" });
  } catch (err) {
    // Roll back the orphaned auth user so a failed profile insert (e.g. a race on the
    // username uniqueness check above) doesn't leave a dangling account with no profile.
    await supabaseAdmin().auth.admin.deleteUser(created.user.id);
    if (err instanceof SupabaseQueryError && err.code === "23505") {
      return { ok: false, error: "That username is taken" };
    }
    throw err;
  }

  const supabase = await supabaseServer();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return { ok: false, error: "Account created — please log in" };

  return { ok: true, userId: created.user.id };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string };

export async function login(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password" };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, error: "Invalid email or password" };

  return { ok: true, userId: data.user.id };
}

export async function logout(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}
