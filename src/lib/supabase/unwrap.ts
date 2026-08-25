import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Every repository/social function used to be a synchronous in-memory array op that
 * literally could not fail. A real Postgres call can — surface that loudly (throw, becoming
 * a 500 via Next's default route/render error handling) rather than silently swallowing it,
 * matching "don't add error handling for scenarios that can't happen, but do surface real
 * failures" — a dropped connection is a real failure, not a scenario to paper over.
 */
export class SupabaseQueryError extends Error {
  code: string;
  constructor(error: PostgrestError) {
    super(`Supabase error: ${error.message}`);
    this.code = error.code;
  }
}

/**
 * Deliberately untyped rather than generic: supabase-js's actual response shape for
 * `.single()`/`.maybeSingle()` is a discriminated union (`{data: T, error: null} |
 * {data: null, error: PostgrestError}`), which infers unreliably through a generic
 * parameter. Every call site already types its own row shape loosely (`Row =
 * Record<string, any>`) and re-establishes real typing via a rowToX() mapper immediately
 * after — this function only needs to throw on error and hand back whatever's there.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap(result: { data: any; error: PostgrestError | null }): any {
  if (result.error) throw new SupabaseQueryError(result.error);
  return result.data;
}
