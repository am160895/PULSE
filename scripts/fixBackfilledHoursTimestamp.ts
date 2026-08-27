/**
 * One-time correction: scripts/backfillTypicalHours.ts ran before a bug fix to
 * repository.ts's replaceHours() was in place, which stamped every backfilled row with
 * last_verified_at = now instead of leaving it null — making freshly-estimated hours read
 * as MEDIUM confidence ("Closes at X") instead of the intended LOW confidence ("Hours may
 * vary"), undermining the whole point of labeling them as estimates.
 *
 * source = 'SEED' AND last_verified_at IS NOT NULL is an unambiguous signal for exactly
 * the rows this bug affected: the ORIGINAL scripts/seed.ts synthetic venues always insert
 * SEED rows with a null timestamp directly (bypassing replaceHours entirely), and no other
 * code path ever writes a non-null last_verified_at on a SEED-sourced row. Clears it.
 *
 * Run with: npm run fix:hours-timestamp
 */
import { supabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const { data, error } = await supabaseAdmin()
    .from("venue_hours")
    .update({ last_verified_at: null })
    .eq("source", "SEED")
    .not("last_verified_at", "is", null)
    .select("id");
  if (error) throw new Error(`Supabase error: ${error.message}`);
  console.log(`Cleared last_verified_at on ${data?.length ?? 0} SEED hours rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
