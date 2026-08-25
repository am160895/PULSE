import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SupabaseQueryError } from "@/lib/supabase/unwrap";
import { createUserWithProfile, getProfileByAuthUserId, getProfileByUsername } from "@/lib/data/social";
import type { Profile } from "@/types";

export interface Session {
  userId: string;
  profile: Profile;
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

  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) return null;

  return { userId: user.id, profile };
}

/** Returns the session only if it belongs to an admin — every /admin page and
 * /api/admin/** route calls this and treats null as "not authorized," never trusting a
 * client-supplied role claim. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getCurrentSession();
  if (!session || session.profile.role !== "ADMIN") return null;
  return session;
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
