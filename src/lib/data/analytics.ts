import type { AnalyticsEventName } from "@/types";
import { ANALYTICS_EVENT_NAMES } from "@/config/constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SupabaseQueryError } from "@/lib/supabase/unwrap";

/**
 * Best-effort acquisition-funnel analytics (growth spec) — never allowed to break or slow
 * down the action it's measuring, same non-blocking convention as sendWelcomeEmail. Only
 * ever a named event plus optional profile/venue ids — no free-text, no location payload,
 * matching the spec's "no unnecessary personal/location data" requirement.
 */
export async function recordAnalyticsEvent(input: {
  event: AnalyticsEventName;
  profileId?: string | null;
  venueId?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("analytics_events")
      .insert({ event: input.event, profile_id: input.profileId ?? null, venue_id: input.venueId ?? null });
    if (error) console.error("recordAnalyticsEvent: insert failed", error);
  } catch (err) {
    console.error("recordAnalyticsEvent failed:", err);
  }
}

/**
 * All-time count per event, for the admin funnel dashboard. One exact-count, head-only
 * query per event (13 total) rather than a single grouped aggregate — supabase-js's query
 * builder has no GROUP BY, and a Postgres view/RPC would be overkill for an admin page
 * loaded infrequently; the (event, created_at) index (migration 0004) keeps each of these
 * a cheap index-only count.
 */
export async function getFunnelCounts(): Promise<Record<AnalyticsEventName, number>> {
  const entries = await Promise.all(
    ANALYTICS_EVENT_NAMES.map(async (event) => {
      const { count, error } = await supabaseAdmin()
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event", event);
      if (error) throw new SupabaseQueryError(error);
      return [event, count ?? 0] as const;
    })
  );
  return Object.fromEntries(entries) as Record<AnalyticsEventName, number>;
}
