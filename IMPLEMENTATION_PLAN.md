# PULSE — Implementation Plan

Real-time nightlife/venue intelligence app. Manhattan launch (9 neighborhoods, ~150 venues).

> **Superseded (README §15/§30):** the "local dev layer" and "not Supabase Auth yet" points
> below describe this app's *early* state. Both have since been fully replaced with a real
> Supabase project and real Supabase Auth — `src/lib/data/store.ts` and the local user store
> no longer exist. Kept here as the historical record of why those choices were made at the
> time; README is the current source of truth.

## Architecture decisions

- **Next.js 16 (App Router, Turbopack default), TypeScript, Tailwind v4.** Next 16 breaking changes that matter here: `params`/`searchParams` are async, `middleware.ts` → `proxy.ts` (function renamed `proxy`).
- **Database, staged in two layers:**
  - *Source of truth (production):* `supabase/migrations/*.sql` — full Postgres schema, PostGIS `geography(Point)` columns + GiST indexes for geo queries, RLS policies, enums, constraints. This is what a real Supabase project runs.
  - *Local dev layer (superseded — see note above):* `better-sqlite3` was attempted and rejected — no working MSVC toolchain in this environment, and forcing a native build isn't worth it for a swappable dev layer. Instead: an in-memory store (`src/lib/data/store.ts`) seeded from generated JSON, persisted to a local JSON file on writes. It implemented the exact same repository interface (`src/lib/data/repository.ts`) that the real Supabase-backed implementation now satisfies — the swap was an adapter change, not a rewrite, as intended.
- **Map: MapLibre GL JS**, not Mapbox/Google Maps as literally specified. Both require an API key/account before anything renders, which blocks "build it now." MapLibre is Mapbox-GL-API-compatible and open-source; using a free, keyless CARTO dark basemap style gets a real interactive map working today. Moving to Mapbox's own styled tiles later is a style-URL/token change.
- **Auth**: real Supabase Auth (see note above — this replaced the original local-user-store bcrypt/HMAC-cookie auth described when this doc was written).
- **Geo**: haversine distance + bounding-box filtering in JS (unchanged after the Supabase swap — `listVenuesInBounds` still filters an already-fetched venue list rather than a live PostGIS `ST_DWithin` query). Production migration still has PostGIS `ST_DWithin`/`&&` available as documented in the migration file if this becomes a real bottleneck.
- **Live refresh**: TanStack Query polling (map ~45s, venue detail ~20s) rather than Supabase Realtime — a deliberate choice, not a placeholder; the polling interval is a config constant, trivially swapped for a Realtime subscription later if needed.
- **Server Actions vs Route Handlers**: Route Handlers (`app/api/**/route.ts`) for all mutations (reports, presence, friends, saved, auth) since the map/report UI is client-driven and needs fetch semantics; validated with Zod server-side on every input.

## Pulse Score engine (deterministic, testable, explainable)

`src/lib/pulse/calculatePulseScore.ts` combines six signals into a 0–100 score plus a separate 0–100 confidence score:

| Signal | Weight (base) | Notes |
|---|---|---|
| Live reports | 35% | exponential time-decay (≈25 min half-life), trust-weighted, proximity-weighted, per-user contribution capped |
| Trend | 20% | score now vs. 15/30 min ago, smoothed |
| Historical baseline | 20% | hourly, day-of-week, category-aware curve |
| Event | 10% | additive boost only, capped, never alone creates "hot" |
| Friend activity | 5% | count of friends currently present, capped |
| Time/openness | 10% | closed or about-to-close venues decay toward 0 |

**Weights are dynamic, not fixed**: when live-report confidence is low, weight shifts toward the historical baseline (see `signals/confidence.ts` driving `blendWeights`). Correlated inputs (vehicle-age-style double counting doesn't apply here, but "trend" and "live reports" are correlated) are damped by deriving trend from the *score history*, not from raw reports directly, so it can't double-count the same evidence.

**Score smoothing**: new score = `0.65 * previousScore + 0.35 * rawSignalScore`, with the blend ratio flexing toward the raw signal when confidence/consensus is high (§87 of the spec). This prevents a couple of reports from swinging a venue 50→95 in one update.

**Confidence** is fully separate from the score (§18): driven by report count/recency/agreement, verified-proximity ratio, and historical sample size. Displayed as HIGH/MEDIUM/LOW, never blended silently into the score number.

**Anti-gaming** (`src/lib/reports/*`): one report per user per venue per 25 minutes (cooldown), per-report contribution cap, trust-weighted averaging instead of simple averaging, disagreement lowers confidence instead of being hidden, and repeated identical reports from the same account are down-weighted, not deleted (auditability).

## Privacy model

- Presence (`AT_VENUE` / `HEADING_THERE` / `NEARBY` / `RECENTLY_HERE`) is opt-in per share, defaults to `PRIVATE`, always has an `expires_at`, and is never exact GPS — venue-level or "nearby" only.
- Visibility resolution (`src/lib/presence/visibility.ts`) checks friendship status + block list + chosen audience (`PRIVATE`/`CLOSE_FRIENDS`/`FRIENDS`) + expiry on every read. Tested explicitly (blocked users, expired presence, non-friends never see anything).
- Proximity verification for reports stores a boolean (`is_verified_nearby`), not a persisted exact coordinate.

## Cold start

Every venue always has a historical-baseline-derived score, so the map is never empty even with zero live users. Confidence is labeled LOW in that case and the UI says "based on typical Fridays," never claims "live" for data older than 5 minutes (freshness bands in §71 of the spec, implemented in `src/lib/pulse/signals/confidence.ts` and surfaced via `FreshnessBadge`).

## Build order

1. Design tokens, types, config constants
2. Geo utilities + tests
3. Local data layer + seed generator (150 venues, hourly baselines, category-aware curves)
4. Pulse Score engine (score/confidence/trend/anti-gaming) + unit tests
5. Auth (session, login/signup) + proxy route protection
6. API routes (venues, reports, presence, friends, saved, explore)
7. Map page (MapLibre, clustering, filters, search)
8. Venue bottom sheet + venue detail page + activity graph
9. Reports UI (one-tap flow)
10. Friends + presence + privacy settings UI
11. Explore page (all sections)
12. Landing page + onboarding
13. Demo night simulator (dev-only, feeds the real report pipeline — not a scoring shortcut)
14. Lint/typecheck/build pass, README

## Key risks flagged up front

- No live users at demo time ⇒ everything you see is historical-baseline-driven with LOW/MEDIUM confidence, which is the *correct* honest behavior, not a bug — worth saying explicitly during a demo.
- (Superseded — see note at the top of this file) In-memory local store does not survive a server restart's *code* changes. No longer applicable: the data layer is now real Supabase, which survives restarts and multi-instance deploys by design (README §21).
