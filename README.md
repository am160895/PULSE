# PULSE

**Know where the night is happening.** PULSE turns live user reports, historical activity
patterns, events, and (opt-in, privacy-first) friend presence into a single explainable
0–100 **Pulse Score** per venue — plus a separate confidence score, so a quiet night with no
data never gets dressed up as certainty.

Launch market: Manhattan (West Village, Greenwich Village, SoHo, Lower East Side, East
Village, Chelsea, Meatpacking, Nolita, NoHo) — 140 generated venues + 5 hand-tuned showcase
venues.

---

## 1. What was built

A working, running MVP, not a mockup:

- **Real-time map** (MapLibre GL, clustered markers, search, filter chips) that shows every
  venue's live Pulse Score, color-coded by status, with a pulse animation on genuinely hot
  venues.
- **Deterministic, explainable scoring engine** (`src/lib/pulse/**`) blending live reports,
  historical baselines, trend, events, and friend presence, with a separate confidence score
  and a plain-language "why now" explanation — never an opaque number.
- **One-tap crowd reporting** with real anti-gaming: cooldowns, exponential time-decay, trust
  weighting, proximity verification, and score smoothing so no single report can spike a
  venue to "hot."
- **Privacy-first friend presence**: opt-in, auto-expiring, venue-level (never exact GPS),
  with a real visibility-resolution function that's unit-tested against every combination of
  blocked/pending/accepted/close-friend/expired.
- **Venue detail pages** with an activity graph (actual + typical/forecast), nearby
  alternatives when a venue is falling or has a long wait, and a "what's this based on"
  breakdown.
- **Explore page** with eight rule-based lenses on the same underlying data (Hot Now, Rising
  Fastest, Near You, Friends Are Here, Worth the Trip, Quiet but Good, No-Line Picks,
  Late-Night) — no separate "trending" model, just different filters on one honest score.
- **Real auth** (bcrypt + signed session cookie), friends (request/accept/block/close-friend),
  saved venues, and privacy settings that actually persist and take effect.
- **40 passing unit tests** covering the scoring engine's bounded-ness, anti-gaming, and the
  privacy visibility rules — the parts of this product where "looks right" isn't good enough.
- **Full production Postgres/PostGIS/RLS schema** (`supabase/migrations/0001_init.sql`) as
  the source of truth for a real deployment, even though the app runs locally today against
  a swappable in-memory data layer (see §4/§15 for why and how to switch).

## 2. Tech stack

- **Next.js 16** (App Router, Turbopack — the default in 16), **TypeScript**, **React 19**
- **Tailwind CSS v4** (CSS-first config) with a hand-written dark design system in
  `src/app/globals.css`
- **MapLibre GL JS** for the map (see §16 for why not Mapbox/Google Maps as literally spec'd)
- **Supercluster** for marker clustering
- **TanStack Query** for client-side polling/refresh
- **Recharts** for the activity graph
- **Zod** for all server-side input validation
- **bcryptjs** for password hashing (pure JS — no native build step)
- **Vitest** for unit tests
- **Supabase/Postgres/PostGIS** as the target production database (migration written,
  not yet connected — see §15)

## 3. Repository structure

```
src/
  app/
    (app)/            map, explore, venue/[id], friends, saved, you, settings/*  (protected)
    api/               every route handler — venues, reports, presence, friends, privacy,
                        saved, explore, auth, dev/simulate
    login, signup, page.tsx (landing)
  components/
    map/               MapView (MapLibre), search + filter chips
    venues/            score/confidence/trend/wait badges, bottom sheet, report sheet,
                        activity graph
    ui/                bottom nav, empty/loading states, logout button
    providers/         TanStack Query provider
  lib/
    pulse/             the scoring engine — calculatePulseScore.ts + signals/*, explore.ts
    reports/           cooldown, trust scoring, submitReport validation
    presence/          visibility resolution, default preferences
    auth/               session signing/verification, login/signup
    data/               store.ts (in-memory + JSON persistence), repository.ts, social.ts
    simulation/         category activity curves + the demo "simulate a night" generator
    geo/, time/         haversine/bounding-box math; timezone-correct hour/day lookups
  hooks/api.ts          TanStack Query hooks
  types/, config/        shared types/enums; tunable constants (weights, decay, bands)
supabase/migrations/     production Postgres schema + RLS (0001_init.sql)
scripts/seed.ts          demo data generator
tests/                   vitest unit tests
```

## 4. Database overview

`supabase/migrations/0001_init.sql` is the real, and only, schema — full Postgres, `postgis`
`geography(Point)` columns + GiST indexes, every enum from the spec, RLS policies on every
table, and a real GiST-exclusion-constraint cooldown backstop at the DB layer (§15/§29 cover
how the app actually connects to it). There used to be a second, dev-only in-memory layer
(`src/lib/data/store.ts`) so PULSE was clickable before a Supabase project existed — it has
been fully removed, not just deprioritized. Every function in `repository.ts`/`social.ts` now
calls Supabase directly.

Identity note: reports, presence, trust scores, and saved venues all key off `profiles.id`
(not the raw Supabase Auth user id) — matching the SQL migration. The auth user id (from
`supabase.auth.getUser()`) is only ever used once per request, to resolve into a profile.

## 5. Map architecture

The spec calls for Mapbox or Google Maps. Both require an API key/account before anything
renders, which conflicts directly with "build it now." **MapLibre GL JS** is
Mapbox-GL-API-compatible and open source; paired with a free, keyless CARTO dark basemap
style, the map genuinely works today with zero account setup. Moving to Mapbox's own styled
tiles later is a style-URL/token change in `src/config/constants.ts` (`MAP_STYLE_URL`), not a
rewrite.

**Two real bugs were found and fixed while getting this running** (worth knowing if you touch
`MapView.tsx`):

1. MapLibre GL v6's worker script has an `import` dependency on a sibling module
   (`maplibre-gl-shared.mjs`) that Turbopack doesn't resolve automatically. The fix: MapLibre
   ships a prebuilt worker bundle for exactly this situation — both files are copied into
   `public/` and `maplibregl.setWorkerUrl()` points at them explicitly before the map is
   constructed.
2. MapLibre's own stylesheet sets `.maplibregl-map { position: relative }` on the map
   container, which silently defeats a Tailwind `absolute inset-0` class (equal CSS
   specificity, their rule loads later) and collapses the container to zero height — so the
   map computed it needed zero tiles for a zero-height viewport. Fixed with an inline style
   (which always wins over class-based rules) forcing `position: absolute` with explicit
   inset values.

Marker clustering uses **Supercluster**, rebuilt from the current venue list on every
bounds/zoom change and rendered as plain MapLibre DOM `Marker`s (not a GL layer) — simple,
correct at this venue count (~150), and doesn't require GL-layer feature-state management.

## 6. Pulse Score logic

`src/lib/pulse/calculatePulseScore.ts` combines six signals:

| Signal | Low-data weight | High-data weight |
|---|---|---|
| Live reports | 5% | 45% |
| Trend (momentum) | 5% | 25% |
| Historical baseline | 65% | 10% |
| Event | 15% | 15% |
| Friend activity (aggregate, privacy-safe) | 10% | 5% |

**Weights are interpolated**, not fixed, by a `reportConfidenceFactor` (0–1, driven by how
many effective/weighted live reports exist). This is the one thing worth understanding if you
read the code: a *single* fixed weight table can only satisfy "sparse reports → baseline
matters more," not also "strong reports → baseline matters less." Interpolating between a
low-data table (baseline-dominant) and a high-data table (report-dominant) satisfies both
directions of the spec's own stated rule. This was caught and fixed by a failing unit test
during development (see `tests/pulse.test.ts` — "can reach the HOT_NOW band...").

**Trend** is derived from the venue's own score *history*, not raw reports directly — so it's
interpolated by the same confidence factor as live reports, which prevents the same evidence
from being counted twice under the guise of two "independent" signals.

**Openness** (is the venue even open right now) is applied as a **multiplicative gate** on
the final blend, not averaged in as a seventh component. A naive weighted average would let a
closed Tuesday-2am bar still show ~60 on the strength of its Friday-night historical baseline
— wrong. Gating the whole blend by an openness factor (0 when closed, ramping over the first/
last 30 minutes of the day) is the stronger design.

**Score smoothing**: `finalScore = previousScore × retention + rawBlend × (1 − retention)`,
where `retention` itself shrinks from 0.65 toward 0.30 as confidence rises — so a lone report
can nudge a score, but can't spike it, while a night with many agreeing verified reports can
move faster. On a venue's very first-ever computation there's no `previous` to smooth
against, so the first score is just the raw blend (no artificial anchor).

## 7. Confidence logic

Confidence (0–100, labeled HIGH/MEDIUM/LOW) is **fully separate** from the score — it's never
blended in silently. It's driven by: how many effective (decayed, trust-weighted) reports
exist, how much they agree with each other, what fraction were proximity-verified, and the
historical sample size. Critically: **confidence from historical data alone is capped at 55**
(never HIGH) — a brand-new product with zero real observed history should never claim high
confidence just because a category-typical curve exists. On day one, before real users
report anything, every venue is correctly LOW/MEDIUM confidence. That's the honest behavior,
not a bug (see §13, Cold start).

Freshness is a related but distinct concept, shown separately: LIVE (≤5 min), RECENT (≤15),
ESTIMATED (≤45), or TYPICAL (older/no reports) — so the UI never calls 45-minute-old data
"live."

## 8. Trend logic

Compares the most recent score snapshot to the one from ~30 minutes prior:
`RISING_FAST` (≥+10), `RISING` (≥+4), `STABLE`, `FALLING` (≤−4), `FALLING_FAST` (≤−10). It
feeds back into the score blend as a "momentum component" (50 = neutral, scaled by the
delta), gated by the same confidence factor as live reports (see §6). Expected-peak time is
estimated by scanning the next 6 hours of the historical baseline curve for the highest
point still ahead — displayed as a *range*, widened when confidence is low, never a false-
precision single minute.

## 9. Anti-gaming logic

- **Cooldown**: one report per user per venue per 25 minutes (`checkReportCooldown`), also
  backstopped at the SQL layer with a unique index on `(user_id, venue_id, minute)`.
- **Exponential time decay**: report weight halves every 25 minutes, reaching ~0 by 3 hours —
  so "PACKED at 11pm" doesn't still move the score at 2am.
- **Trust weighting**: every report is weighted by the reporting user's live trust score
  (0.15–1.0, starts at 0.5, penalized for brand-new accounts, nudged up on agreement / down on
  flags), not by a fixed value stored at submission time — an account discovered to be
  unreliable loses influence on everything going forward, not just future reports.
- **Proximity verification**: reduces to a boolean (`isVerifiedNearby`) that boosts weight —
  the raw coordinate used to check it is *never persisted* (see §10).
- **Cap via weighted averaging, not a hard clamp**: because the live-report component is a
  weighted *average* of all recent reports (not a sum), one report among ten disagreeing ones
  barely moves the average; a single report in isolation is capped by the confidence-driven
  weight interpolation itself (§6) — low report count ⇒ low weight given to reports at all.
  `tests/pulse.test.ts` verifies concretely that one unverified report cannot push a venue
  toward 100.
- **Agreement requires corroboration**: a single report trivially has zero variance against
  itself, so a naive "agreement score" would hand a lone, unverified, low-trust report the
  same confidence bonus as five reports that happen to agree. `calculateConfidenceSignal`
  only credits the agreement bonus once at least 2 independent reports exist — this was a
  real gap caught during development (an earlier version let one report reach MEDIUM
  confidence on agreement alone), fixed by gating on report count rather than just averaging.
- **Repetition detection**: `detectRepetitivePattern` flags (for future moderation review,
  not auto-blocking) a user who submits the identical crowd/wait/energy combination four
  times in a row.

## 10. Privacy model

- Presence (`AT_VENUE` / `HEADING_THERE` / `NEARBY` / `RECENTLY_HERE`) defaults to
  **PRIVATE**, is always opt-in per share, always has an `expiresAt`, and is never exact
  GPS — venue-level only.
- **`src/lib/presence/visibility.ts`** is the single choke point every presence read goes
  through: owner always sees their own; anything else requires an ACCEPTED (non-blocked)
  friendship, respects PRIVATE/FRIENDS/CLOSE_FRIENDS audience choice (close-friend status is
  a separate one-way tag, not a friendship tier — see the schema), and checks expiry. It's
  unit-tested against every combination in `tests/presence.test.ts`.
- The **same rule is re-implemented at the RLS layer** in the SQL migration
  (`presence_events_friend_read` policy) so a real deployment enforces this in the database
  itself, not only in application code.
- Proximity verification for reports computes a boolean server-side and never writes the raw
  coordinate to storage — "temporarily storing" GPS tends to become permanently storing it.
- The venue-level Pulse Score's "friend activity" input is a **privacy-safe aggregate**
  (anyone with active `AT_VENUE` presence, regardless of relationship) rather than the
  viewer's personal friend graph — using a private, per-viewer signal to move a publicly
  shared number would leak presence information indirectly. The personalized "3 friends
  here" shown on the venue page is a separate, per-request, properly-filtered computation
  that never feeds back into the shared score.

## 11. How user reports work

Tap **I'm here** → one-tap sheet (busy? wait? energy? optional 100-char note, optional "also
let friends see I'm here" checkbox) → `POST /api/venues/[id]/reports`. Server: checks the
session, checks cooldown, computes proximity verification if location was shared, validates
with Zod, writes the report, updates the reporter's trust-score submission count, and returns
the *immediately recomputed* score so the UI updates without waiting for the next poll. A
report older than ~3 hours has effectively zero remaining influence (decay).

## 12. How friend presence works

Add a friend by username → request goes `PENDING` → the other side accepts/declines. Once
`ACCEPTED`, either side can tag the other as a "close friend" (a separate, one-directional
tag — this is a deliberate addition beyond the literal spec table list, because
`CLOSE_FRIENDS` as a visibility *option* is meaningless without something that actually
defines who counts, and shipping a selectable-but-non-functional enum value would be exactly
the "fake button" the brief warns against). Presence is created either from the report
sheet's checkbox or (architecturally) via `POST /api/presence`, always time-boxed, always
endable early via `DELETE /api/presence`.

## 13. How cold start is handled

Every venue always has a historical-baseline-derived score, seeded from a category- and
day/hour-aware activity curve (`src/lib/simulation/activityCurve.ts`) — so the map is never
empty even with zero live users. Confidence is honestly LOW in that case, and the UI copy
says "no live reports yet — based on typical activity," never "live." The demo seed data
intentionally seeds most of the 140 background venues with **zero** synthetic reports outside
their peak hours (the simulator's adoption-rate model only fires reports proportional to
expected activity) — the map is meant to demonstrate the honest cold-start story, not paper
over it with fake liveliness everywhere.

## 14. How to run locally

PULSE runs against a real Supabase (Postgres) project — there is no local/in-memory data
layer anymore (see §15 for the history of that decision). You need a Supabase project and
`.env.local` before any of this works; §15 walks through creating one from scratch.

```bash
npm install
npm run seed      # wipes+regenerates demo data in Supabase — 140 venues + 5 showcase venues + demo accounts
npm run dev        # http://localhost:3000
```

Log in with **demo@pulse.app / pulsedemo123** (or any of the seeded reporter accounts:
james@pulse.app, conor@pulse.app, maria@pulse.app, priya@pulse.app, liam@pulse.app,
ava@pulse.app — same password; the demo account is seeded as `ADMIN`, the rest as `USER`).
Re-run `npm run seed` any time to reset to a fresh dataset — it's safely re-runnable: it
deletes only the known demo accounts by email (cascading away everything scoped to them:
reports, presence, friendships, saved venues) and wipes+regenerates all venues, without
touching any other real account you've created via signup.

Showcase venues (open 24/7 by design, unlike the other 140, so the demo narrative works
regardless of what time you actually run it): **Little Sister**, **Dante**, **Night Owl**,
**Room 57**, **The Roof** — search for any of them on the map or in Explore.

## 15. Supabase setup

1. Create a Supabase project (free tier is enough) and enable the `postgis` extension
   (Database → Extensions).
2. Run `supabase/migrations/0001_init.sql` against it — paste it into the SQL Editor and
   run, or `supabase db push` via the CLI. It creates every table, RLS policy, and the
   `is_admin()`/`is_close_friend()`/cooldown-window helper functions in one shot; rerunning
   it against an already-migrated database will error on "already exists" (reset with `drop
   schema public cascade; create schema public; grant usage on schema public to postgres,
   anon, authenticated, service_role; grant create on schema public to postgres, anon,
   authenticated, service_role;` first if you need to start over).
3. Project Settings → API gives you the three values for `.env.local` (see §17):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   The service-role key bypasses RLS entirely — never commit it or expose it to the client
   (`.env*` is gitignored; nothing with `NEXT_PUBLIC_` prefix touches it).
4. `npm run seed`, then `npm run dev`.

**How the data layer actually works** (this used to be an in-memory/JSON-file dev store —
fully removed, not just deprioritized): every function in `src/lib/data/repository.ts` and
`social.ts` is `async` and calls Supabase directly via a service-role client
(`src/lib/supabase/admin.ts`). Authorization is enforced at the API-route layer (session +
role checks), the same convention the old local store used — RLS is a defense-in-depth
backstop for the day a client talks to Supabase directly, not the primary gate today.
Auth itself is real Supabase Auth (`src/lib/supabase/server.ts`, `@supabase/ssr`) — signup
creates a real `auth.users` row via the admin API with `email_confirm: true` (no email
sending is configured) immediately followed by a real sign-in to establish the session —
`profiles.auth_user_id` is a hard foreign key to `auth.users(id)`, so there's no parallel
password store anymore. `proxy.ts` refreshes the Supabase session on every request, per
Supabase's own Next.js middleware guidance.

**Node version note**: this environment runs Node 20, but `@supabase/supabase-js` eagerly
constructs a Realtime (WebSocket) client at `createClient()` time even though this app never
opens a realtime subscription — everything polls via TanStack Query instead. Node 20 has no
global `WebSocket` (added in Node 22), which crashes client construction outright. Fixed by
passing the `ws` package as the realtime transport in all three client-construction sites
(`admin.ts`, `server.ts`, `proxy.ts`) — see the comments there. Upgrading to Node 22+ would
make this unnecessary but wasn't required.

## 16. Map provider setup

Default: **MapLibre GL + CARTO's free dark-matter style** (`MAP_STYLE_URL` in
`src/config/constants.ts`), no account or key needed. To switch to Mapbox's own hosted style
(for custom branding): create a Mapbox account, get a style URL + access token, and change
`MAP_STYLE_URL` to `https://api.mapbox.com/styles/v1/...access_token=...`. No other code
changes needed — the MapLibre GL JS API is compatible.

## 17. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Client-safe anon key (used for auth only, never for data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-only, bypasses RLS — never `NEXT_PUBLIC_`, never exposed to the client |
| `INITIAL_ADMIN_EMAIL` | No (needed to reach `/admin` in a fresh, non-seeded database) | The email that becomes `ADMIN` on signup — see §29 |

Put these in `.env.local` (gitignored via `.env*`) — `npm run dev`/`next build` load it
automatically; `npm run seed` loads it explicitly via `tsx --env-file=.env.local` since it
runs outside Next's own env loading. There's no local/no-`.env` fallback anymore (§15) —
without these three, nothing that touches data or auth will work. Custom session-cookie auth
(`AUTH_SECRET`, a per-app HMAC signing key) has been fully replaced by real Supabase Auth —
see §15.

## 18. Seed data

`scripts/seed.ts` (`npm run seed`) generates: 140 venues distributed across the 9 launch
neighborhoods with category-appropriate weighting (e.g. Meatpacking skews clubs/lounges/
rooftops; Nolita skews restaurants/cafes), realistic-ish addresses on real streets in each
neighborhood, category-and-day-of-week-aware hourly baselines (168 rows per venue), a handful
of live-music show events, 6 reporter accounts + 1 demo account with friendships/presence/
saved-venues pre-wired, and 5 showcase venues with hand-tuned reports/history/events so the
score narrative (rising, falling, quiet-but-good, event-driven) is demonstrable. It prints a
score-distribution summary so you can sanity-check that scoring isn't degenerate (e.g. "is
everything 90+?") every time you reseed.

`scripts/addRealVenues.ts` (`npm run seed:real`) is a separate, one-time script that adds
real, currently-operating NYC bars (name/address/hours verified via web search, not
generated) as genuine `Venue` rows — deliberately *without* any baseline or report data, so
they correctly compute as `DIRECTORY` coverage and show "No live PULSE yet" rather than a
fabricated score for an actual business. Safely re-runnable (dedupes on name+address). This
is the free alternative to wiring up Google Places (§16/§22) for getting real venues into
the map — it doesn't scale the way a live API integration would, but costs nothing and
avoids ever showing invented activity data for a real place.

## 19. Demo simulator

`POST /api/dev/simulate` (dev-only — 404s if `NODE_ENV=production`) re-runs the same
category-activity-curve-driven report generator (`src/lib/simulation/simulateNight.ts`)
against the *current* clock, feeding fresh synthetic reports through the real report
pipeline (not a scoring shortcut) so a demo run hours after seeding still looks reasonably
alive. This satisfies the spec's "dev-only signal simulator" requirement without needing a
separate fake-data code path.

## 20. Test instructions

```bash
npm run test        # vitest — 49 tests: scoring bounds/anti-gaming/confidence/trend, geo math,
                     # report cooldown/proximity/trust, presence visibility privacy rules
npm run lint         # eslint — clean
npx tsc --noEmit     # typecheck — clean
npm run build        # production build — clean
```

No E2E suite is included (Playwright wasn't set up given the time budget) — the flows in the
spec's demo script were instead verified manually in a real running browser during
development (login → map → marker click → venue detail → submit report → cooldown
enforcement → friends/saved/settings), which is how three real bugs (see §5) were actually
caught. Adding Playwright coverage for that same flow is the top item in §22/§23.

## 21. Deployment (Vercel or Railway)

Since §15, PULSE has no in-process data layer at all — every instance talks to the same
Supabase project, so there's no serverless-cold-start or multi-instance data-loss concern
anymore. Either platform works the same way:

1. Push to a Git repo (GitHub/GitLab/Bitbucket), connect it to your Vercel project or Railway
   service. Both auto-detect Next.js and run `next build` / `next start` with no extra config.
2. Set the three Supabase env vars from §17 (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in the platform's environment
   variable settings — same values as your local `.env.local`. Add `INITIAL_ADMIN_EMAIL` too
   if you want a specific email to auto-become admin on first signup against production.
3. Push/deploy. On Railway specifically: `railway up` from the CLI, or connect the repo in the
   dashboard for auto-deploy on push — no `railway.json`/`Procfile` needed, Railway's Nixpacks
   builder detects `npm run build` / `npm start` from `package.json` automatically.
4. Run `npm run seed` **once, locally, pointed at the production Supabase project** (same
   `.env.local`, just with production values) if you want the demo dataset live — or skip it
   entirely and let real signups/admin-created venues populate the database instead.

Editing locally and deploying to Railway (or Vercel) is exactly the normal git-push workflow
— nothing about this app requires editing in a hosted IDE. Local dev and production both talk
to the same Supabase project unless you point `.env.local` at a second (e.g. staging) one.

**Gotcha: fixing a `NEXT_PUBLIC_*` variable after a bad first deploy requires a real rebuild,
not just a restart.** Next.js inlines every `NEXT_PUBLIC_*` variable as a literal at *build*
time, everywhere it's referenced — including server-only code (`proxy.ts`, the Supabase
client factories), not just client bundles. If a `NEXT_PUBLIC_*` value was wrong during the
build that produced your current deployment, editing it in Railway/Vercel's dashboard and
clicking "Redeploy" can silently reuse the previously built files with the old value still
baked in — the dashboard will show the corrected value, the running app will keep using the
old one, and the symptom looks identical to "the fix didn't take." Push a new commit (forces
a genuine rebuild) rather than trusting a restart/redeploy alone whenever a `NEXT_PUBLIC_*`
value changes after a bad first deploy.

## 22. Known limitations

- **No real-time push** (Supabase Realtime, WebSockets) — the map/venue pages poll on an
  interval (45s / 20s). Fine for a demo, not ideal at scale.
- **No E2E test suite** — manual browser verification only (see §20).
- **Per-venue scoring costs real network round-trips now** (it was a free in-memory lookup
  against the old local store). Fixed for *lists* of venues — `computeVenueStatesBatch()`
  (`src/lib/pulse/composeVenue.ts`) scores N venues with a fixed ~8 round-trips total instead
  of ~6*N, used by every endpoint that scores more than one venue at once (map bounds,
  explore, saved, venue-detail's nearby-alternatives). This was found and fixed after the
  first production deploy: the 140-venue map view took 20+ seconds in production before this
  fix (§30), ~1-2s after. The single-venue detail page itself (`computeVenueState`, one
  venue, nothing to batch against) still costs ~6 round-trips serially and is the next real
  target if it's still felt as slow — denormalizing the score computation into a Postgres
  function/view would take it to one round-trip instead of ~6, not done this pass.
- **No moderation UI** — `report_flags` and repetition detection exist as data/signals, but
  there's no admin screen to act on them yet.
- **No geocoding/address validation** for the fictional seed venues — real venue onboarding
  beyond Google Places search would need an actual claim/import flow (architected via
  `VenueClaimStatus`, not yet built — see §28).
- **Notifications page is intentionally inert** — no push/email infrastructure exists, and the
  settings page says so rather than shipping toggles that don't do anything.
- **Google Places integration is implemented but unverified against a real API key** — see
  §28. Without `GOOGLE_PLACES_API_KEY` configured, it no-ops safely and the app runs exactly
  as it did before this integration existed.
- **No analytics/event instrumentation yet** (search, view, save, share, directions-intent
  events) — explicitly deferred to a "Phase 2 — Measurement" pass rather than half-built now.
- **"Better move" and coverage/open-state logic are new and only unit-tested**, not yet
  exercised against a real Google-sourced DIRECTORY venue (none exist without a live API key).

## 23. Top 10 next features, ranked by ROI

1. **Wire up a real Supabase deployment** (§15) — everything else is capped in value until
   the app can run multi-instance/serverless. Highest leverage, moderate effort (most of the
   schema and RLS work is already done).
2. **Playwright E2E suite** covering the exact spec demo script — cheap insurance against the
   exact class of bug this session found manually (map rendering, z-index/layering).
3. **Venue owner/admin claim flow + a tiny dashboard** — lets a real venue see its own traffic
   pattern, which is the natural wedge into monetization (§25 pricing) without touching score
   integrity (owners still can't set their own crowd level).
4. **Supabase Realtime for presence + venue snapshots** — replaces polling, meaningfully
   improves the "live" feel for the flagship UX moment.
5. **CSV/venue-import flow** for onboarding real neighborhoods beyond the seed set — needed
   before any real launch, not needed for the demo.
6. **Push notifications** for saved-venue-rising and friend-nearby (the two "Planned" items
   already named in the Notifications settings copy) — meaningful retention lever once there
   are enough real users to make alerts non-spammy.
7. **Household/neighborhood aggregate "heat" layer** on the map (spec §92/93) — a genuinely
   differentiated feature once there's enough real report density to make it honest.
8. **Weather signal** for rooftops/outdoor venues — cheap to add given the signal-provider
   architecture is already designed for it, meaningfully improves rooftop accuracy.
9. **Moderation admin screen** acting on `report_flags` and the repetition-detection signal —
   needed before opening reporting to the general public at any scale.
10. **PWA install support** — cheap, gives an app-like feel without a native build, worth
    doing once the core loop is proven with real users.

## 24. Critique of the product

- **The biggest real risk is cold start, and the seed data currently masks it more than
  the honest confidence system suggests it should.** Even with the "mostly silent off-peak"
  simulator design, a demo will still show a map with a plausible score on every single
  venue — because historical baselines never leave a venue at "no data." That's the *correct*
  product behavior (the alternative — blank map — is worse), but it means the cold-start
  honesty story is something you have to point out to a viewer ("notice the confidence
  labels"), not something the UI screams on its own. A first-open experience that explicitly
  celebrates low-density data ("Nobody's reported yet tonight — be the first") would sell the
  honesty angle better than a quietly-correct confidence badge.
- **The Pulse Score's dynamic weighting is the product's actual moat, and it's also its
  biggest unverified assumption.** The low-data/high-data weight tables (§6) were tuned by
  hand against a handful of unit-test scenarios, not against real outcome data (did people who
  saw a 90+ score actually find the venue busy?). That validation loop doesn't exist yet and
  can't exist until there's a real launch — which is fine for an MVP, but it means the
  specific numbers in `SCORE_WEIGHTS_LOW_DATA`/`HIGH_DATA` should be treated as a starting
  hypothesis, not a settled model.
- **Friend presence, as built, is privacy-correct but might be too inert to drive habitual
  use.** Defaulting everything to PRIVATE and requiring an explicit opt-in checkbox on every
  single report is the right call for trust, but it also means the "friends are out" hook
  (probably the single strongest retention lever besides raw utility) will see very low
  activation unless there's a stronger nudge toward turning it on once, rather than
  re-deciding every time.
- **The showcase venues being open 24/7 is a demo convenience that slightly undercuts the
  product's own honesty principle** — it's clearly commented and confined to five clearly-
  labeled `(Demo)` venues, but it's worth being upfront that this exists purely to make
  screenshots/demos reliable, not because it's how the product should behave for real venues.

## 25. What I would change before launching to real users

- Do §15 (real Supabase) — non-negotiable before any multi-user launch.
- Add the Playwright suite (§23 #2) and run it in CI before every deploy.
- Replace the hand-tuned score weights with A/B-tested or outcome-validated ones once there's
  real usage data (see the moat/risk note in §24) — ship the current version, but plan the
  instrumentation to validate it from day one (which score bands actually correlate with
  "worth the trip" user behavior — saves, shares, "I'm here" taps).
- Add basic rate limiting at the infrastructure layer (not just the app-level cooldown) —
  the cooldown prevents one user from spamming one venue, but nothing currently stops a
  scripted attacker from creating many accounts to bypass per-account cooldowns. New-account
  trust penalties help but aren't sufficient alone at scale.
- Add a real moderation screen before opening signups publicly — `report_flags` currently has
  no UI consumer.
- Get a legal/compliance read on location-permission copy and data retention before storing
  any real user's location data, even ephemerally for proximity verification.

## 26. What I would not build yet

Everything the spec itself flags as out-of-scope for the MVP remains out-of-scope here too:
full social feed, stories, DMs, exact public live location, event ticketing/booking,
reservations, native mobile apps, payments, venue advertising auctions, an influencer
program, an ML recommendation model, and a full moderation platform. Also not built, by this
session's own judgment: Supabase Realtime (polling is good enough for a demo), a venue-owner
dashboard (real venue-owner accounts don't exist yet), and any billing.

## 27. A 30-day real-world NYC test plan

**Week 1 — instrumented soft launch, one neighborhood.** Pick West Village specifically (best
seed density in this build). Recruit 15–20 real early reporters (bartenders, regulars,
friends-of-the-team) rather than waiting for organic adoption. Turn on the dev simulate
endpoint's *underlying curves* as a fallback only — the goal this week is to see how much
organic reporting actually shows up against the honest cold-start baseline, not to fake
liveliness.

**Week 2 — expand to the full 9-neighborhood set, start tracking the metrics named in the
spec's own product-metrics section**: % of venue views with high-confidence live data,
reports per active user, venues with ≥3 recent reports, and the decision-proxy events (save,
share, "I'm here", directions-equivalent). Ship whatever's needed to log these events — most
of the plumbing (API routes) already exists; this is mostly about not throwing that data
away.

**Week 3 — validate the scoring hypothesis directly**: for every venue that crossed 80+ on a
given Friday/Saturday night, follow up (survey or spot-check) with 10–15 people who viewed it
on the app — did the venue actually feel like what the label said? This is the first real
signal on whether `SCORE_WEIGHTS_HIGH_DATA` needs retuning (§24).

**Week 4 — decide on the friend-presence activation problem** (§24): A/B a stronger one-time
prompt ("share your nights out with 3 friends you pick now") against the current
report-time checkbox, and measure presence-events-created per active user in each arm. This
is the metric that determines whether friend presence becomes a real retention lever or stays
a mostly-unused feature.

**Go/no-go criteria at day 30**: reports-per-active-user trending up (not flat) week over
week, ≥50% of West Village showcase-tier venues (80+ scores) getting real corroborating
reports rather than only historical-baseline scores, and no repeat instances of the
"everything is 90+" or "everything is dead" degenerate-distribution failure modes the seed
script's own summary output is designed to catch.

## 28. Second pass — toward "the real-time demand network for nightlife"

A later request asked PULSE to evolve toward a three-sided (consumer/venue/advertiser)
demand network. Rather than build fake versions of the venue-operator and advertising
products — which need real venues, real subscriptions, and real ad inventory to mean
anything — this pass did three things: (1) fixed real bugs found by an adversarial code
review, (2) implemented Phase 1 ("Consumer Integrity") for real, and (3) added
type-level scaffolding for Phases 3–6 without building hollow UI on top of it.

**Bugs found and fixed** (via an automated multi-dimension review plus manual verification
— see the git history for exact diffs):
- **Critical**: `CLOSE_FRIENDS` presence visibility was self-defeating under RLS — a Postgres
  policy checking another table's rows is itself subject to that table's RLS, so the
  `close_friends` check inside the presence policy could never return true for anyone but the
  presence owner. Fixed with a `SECURITY DEFINER` function, the standard Postgres pattern for
  exactly this composability problem.
- **High**: blocking a user didn't reassign the friendship row's `(requester_id,
  addressee_id)` to `(blocker, blocked)` — if the blocker had originally been the addressee of
  the friend request, the person they blocked could unilaterally call `unblock` on themselves
  and silently erase the block.
- **High**: `POST /api/presence` only checked the `allowVenuePresence` toggle regardless of
  which presence *status* was being shared — turning off "share that I'm nearby" while leaving
  "share that I'm at a venue" on didn't actually stop NEARBY/RECENTLY_HERE shares.
- **High**: the trend signal picked the nearest snapshot ≥30 minutes old with no upper bound —
  across a real gap in snapshot history (a venue reopening after hours closed, or nobody
  viewing the page for a while), this could compare "now" to a snapshot hours old and label
  the result "+70 rising over the last 30 minutes," fabricating momentum that never happened.
  Now bounded to a [30min, 60min) window; outside it, trend honestly reports STABLE.
- **Medium**: login leaked account existence via response timing (bcrypt only ran for
  registered emails); `AUTH_SECRET` fell back to a hardcoded, publicly-committed value in
  production with only a console warning. Both fixed (constant-time dummy-hash comparison;
  fail-closed at request time — see `src/lib/auth/session.ts`'s comment for why it can't fail
  at *import* time without breaking `next build` itself, which also runs with
  `NODE_ENV=production`).
- Several lower-severity fixes: a missing agreement-requires-corroboration check that let a
  single unverified report reach MEDIUM confidence on trivial self-agreement (§9); a dead
  `REPORT_MAX_SINGLE_CONTRIBUTION` constant that was never actually enforced (removed —
  superseded by the confidence-gated weighting itself); an unnecessary Supercluster index
  rebuild on every map pan even when the venue set hadn't changed; a stale-closure bug where
  the map's "selected marker" highlight could never update after the first render; a
  `ReportSheet` submit button rendering underneath the fixed bottom nav at the same z-index
  (found by literally trying to submit a report during manual browser verification); missing
  `aria-pressed` on filter/option chips; several places with `fetch()` calls that had no
  `.catch()`, turning network failures into unhandled promise rejections instead of visible
  errors — consolidated into one `src/lib/http/requestJson.ts` helper used everywhere now;
  a few RLS/schema gaps (a 1-minute-granularity cooldown index that didn't match the real
  25-minute cooldown, now a proper GiST exclusion constraint; a friendships unique constraint
  that didn't prevent both directions of a pair coexisting; a missing `WITH CHECK` that would
  have let a friend request's requester self-accept their own request).

**Phase 1 — Consumer Integrity, actually implemented:**
- `VenueOpenState` (`OPEN`/`CLOSING_SOON`/`CLOSED`/`TEMPORARILY_CLOSED`/`PERMANENTLY_CLOSED`/
  `UNKNOWN`) via one function, `deriveVenueOpenState` (`src/lib/venues/openState.ts`), sharing
  its core hours-window logic with the scoring engine's openness gate
  (`src/lib/venues/hours.ts`) so the two can't drift into "slightly different opening-hours
  logic" the way a naive implementation would.
- `VenueCoverageState` (`LIVE`/`RECENT`/`TYPICAL`/`DIRECTORY`) — `DIRECTORY` means a real,
  known venue with zero PULSE activity data, and the UI (map markers, bottom sheet, venue
  page) now genuinely never shows a score for one — a plain dot on the map, "No live PULSE
  yet" everywhere else, exactly per spec.
- **Google Places provider** (`src/lib/venues/providers/GooglePlacesVenueProvider.ts`) using
  the real Places API (New) — field-masked search and details requests, no scraping, no
  unofficial endpoints. Wired into venue search: searching now supplements local results with
  real Google-sourced venues not already in the local set, materialized as `DIRECTORY`
  venues. Requires `GOOGLE_PLACES_API_KEY`; no-ops safely without it. Full details enrichment
  (hours/rating on view) is designed for but not implemented — see Known Limitations.
- **NOW / ALL PLACES toggle** on the map, wired end-to-end (`?coverage=NOW|ALL` on
  `/api/venues`) — NOW hides `DIRECTORY` listings, ALL shows everything, search always
  searches everything regardless of the toggle.
- **Filter reorganization** (§11): primary chips (Hot now / Rising / No line / Friends) always
  visible; category/Open-now filters moved behind a "More" toggle instead of one long row.
- **"Better move"** (renamed from "Better nearby") now only appears when *this* venue actually
  has a problem — a 15+ minute wait or a falling trend — not just because a higher-scoring
  venue happens to be nearby. A thriving, rising venue no longer suggests people leave it.
- Type-level scaffolding for later phases, added without any UI built on top of it (so nothing
  fake ships): `VenueClaimStatus`, `VenueProblemType`, `NightIntent`, `BusinessStatus`, and
  `externalRating`/`externalRatingCount`/`claimStatus` fields on `Venue` — all wired into the
  type system and the SQL migration's intent, none of it driving a screen yet.

**Explicitly not attempted this pass** (per the request's own instruction to prioritize
Phase 1 and not attempt the whole roadmap at once): PULSE for Venues (claim flow, Tonight
dashboard, Rush Forecast, Capture Gap, Share of Night), any subscription/entitlement
enforcement, PULSE Boost/Rescue, the ad system and its organic/paid firewall, analytics event
instrumentation, and the intent-selection ("Party/Date/Drinks/Chill") onboarding step. All of
these need either real venue-operator relationships, real usage volume, or both, to be
anything other than a demo of empty screens — building them now would mean shipping the exact
"fake button" / "claims stronger than the underlying data permits" failure modes this whole
project is designed to avoid.

## 29. Admin panel

`/admin` (`src/app/admin/`) is a real, working control surface over the same repository
functions the rest of the app uses — a venue created or edited here shows up on the map
immediately, scored by the same engine, with no separate "admin data" copy.

**What it does today:**
- **Dashboard** (`/admin`) — venue/user counts, how many venues came from Google vs. were
  entered manually, reports in the last 24h.
- **Venues** (`/admin/venues`) — searchable table of every venue (including `DIRECTORY`
  Google-sourced ones), toggle active/inactive, delete (with a confirm dialog and a hint to
  deactivate instead), and a full create/edit form (`/admin/venues/new`,
  `/admin/venues/[id]`) covering location, hours (per-day, midnight-crossing supported),
  category/type, price level, and links.
- **Users** (`/admin/users`) — searchable table with report count and trust score, promote/
  demote between `USER`/`ADMIN`. You can't demote or promote yourself (prevents an admin
  locking themselves out) — enforced both in the UI (button disabled) and the API route.

**How access control works (defense in depth, same pattern as report/presence writes):**
1. `proxy.ts` requires *some* valid session to reach `/admin/**` at all.
2. `src/app/admin/layout.tsx` (server component) calls `getAdminSession()` and redirects to
   `/map` if the session's `role` isn't `ADMIN`.
3. Every `/api/admin/**` route independently calls `getAdminSession()` again — the UI check
   is a convenience, not the actual boundary.
4. `supabase/migrations/0001_init.sql` has matching `is_admin()`-gated RLS policies, so the
   guarantee holds at the database layer too, not just in application code — though today
   every actual read/write goes through the service-role client (§15), which bypasses RLS;
   these policies are the backstop for the day a client talks to Supabase directly.

**Bootstrapping the first admin.** Nothing can grant the `ADMIN` role through the admin panel
itself until at least one admin exists, so the very first one is set via an environment
variable: if `INITIAL_ADMIN_EMAIL` matches the email used at signup, that account is created
as `ADMIN` (`src/lib/data/social.ts`, `createUserWithProfile`). After that, promote further
admins from `/admin/users` instead of the env var. The seeded demo account (`demo@pulse.app`)
is hardcoded to `ADMIN` in `scripts/seed.ts` so the panel is reachable immediately after
`npm run seed` without setting anything.

**Not built:** the bar-owner-facing side ("PULSE for Venues" — a venue claiming a listing and
managing it themselves) is a different, unbuilt product surface from this internal admin
panel. This session's scope was explicitly the internal admin panel only; see §28's
"Explicitly not attempted this pass" for why the venue-operator product needs real
venue-operator relationships before it's worth building for real.

## 30. Third pass — wiring real Supabase, replacing the local data layer entirely

A later request asked for online deployment guidance, an admin panel (§29), and confirmation
that a local-edit → Railway-deploy workflow would work. The user chose "wire real Supabase
now" over deferring it, so this pass replaced the local in-memory/JSON-file data layer with a
real Supabase project end to end — not a partial wiring, the local layer is gone
(`src/lib/data/store.ts` deleted, along with the custom bcrypt/HMAC-cookie auth it depended
on).

**What changed:**
- `src/lib/data/repository.ts` and `social.ts` — every exported function is now `async` and
  calls Supabase directly via a service-role client (`src/lib/supabase/admin.ts`), instead of
  operating on an in-memory array. Same function names/signatures (now `Promise`-wrapped), so
  every call site across ~25 files needed `await` added, not a rewrite.
- Auth fully moved to Supabase Auth (`src/lib/supabase/server.ts`, `proxy.ts`) — signup now
  creates a real `auth.users` row (admin API, `email_confirm: true`, no email flow
  configured) then signs in immediately; login/logout use `signInWithPassword`/`signOut`.
  `src/lib/auth/session.ts` (the custom HMAC session signer) and `bcryptjs` are gone —
  Supabase manages password hashing and session tokens now. `proxy.ts` refreshes the
  Supabase session on every request per Supabase's own Next.js middleware guidance.
- `scripts/seed.ts` now writes directly to Supabase (batched inserts, chunked at 500 rows —
  the hourly-baseline table alone is ~23.5k rows) instead of a local JSON file, and creates
  real Supabase Auth users for the demo accounts. It's still safely re-runnable: it deletes
  only the known demo accounts by email (cascading away everything scoped to them) and wipes
  all venues, without touching any other real signup.

**Bugs found and fixed** (all found by actually running the migration and the app against a
real database, not by inspection alone):
- **Migration ordering**: `is_admin()`/`is_close_friend()` were defined *after* the RLS
  policies that reference them — Postgres resolves policy function references at
  `CREATE POLICY` time, so this failed with "function does not exist" the first time the
  migration ran for real. Moved both definitions above every policy.
- **Non-immutable exclusion constraint**: the report-cooldown GiST exclusion constraint
  computed `tstzrange(created_at, created_at + interval '25 minutes')` inline — Postgres
  rejects this because `timestamptz + interval` uses a function marked `STABLE` (timezone-
  dependent in general), not `IMMUTABLE`, which index/exclusion expressions require. Fixed by
  materializing the range into a plain trigger-set column instead of a live expression —
  ordinary columns carry no immutability requirement.
- **Schema drift**: `businessStatus`/`externalRating`/`externalRatingCount`/`claimStatus`
  had been added to the `Venue` TypeScript type in an earlier pass (§28) but never added to
  the SQL migration — the seed run itself caught this ("column does not exist") since it's
  the first thing that ever tried to write those columns for real.
- **Seed data violated its own app-level constraint**: both the background report simulator
  (random reporter/timestamp picks) and the hand-tuned showcase venues (a small reporter pool
  cycled across many closely-spaced reports) could coincidentally assign the same reporter to
  the same venue within the 25-minute cooldown window — invisible against the old
  constraint-free local store, a real exclusion-constraint violation against Postgres. Fixed
  with a dedup pass (`dedupeReportsForCooldown`) that keeps the earliest report in any
  colliding cluster, which is also the more realistic choice.
- **Systemic missing-`await` bug across 10 API routes** (the most significant finding): after
  converting `repository.ts`/`social.ts` to `async`, `tsc` caught most missing `await`s at
  consumer call sites — but not all. Two call patterns are structurally invisible to
  TypeScript: a truthy check on a function result (`if (!getVenueById(id))` — a `Promise` is
  always truthy, so the "not found" branch silently never fires) and a bare function call
  embedded directly in a `NextResponse.json({...})` object literal (a `Promise` structurally
  satisfies any loose/generic parameter type, so it type-checks while serializing to `{}` at
  runtime). This was caught by manually re-testing the admin panel in a browser after `tsc`
  and `eslint` both passed clean, not by either tool — `admin/venues`, `admin/venues/[id]`,
  `admin/users`, `admin/users/[id]`, `friends/respond`, `friends/close`, `friends/block`,
  `friends/unblock`, `privacy`, and `venues/[id]/saved` all had at least one instance. Fixed
  by a manual grep-and-read sweep of every remaining call site (not relying on `tsc` alone)
  after the first instance surfaced. **This is the reason this pass's verification leaned so
  heavily on actually clicking through the running app against the real database, not just
  green `tsc`/`eslint`/`vitest`/`build` output** — all four passed clean at multiple points
  while this bug was still live.
- **Node 20 vs. `@supabase/supabase-js`**: the library eagerly constructs a Realtime
  (WebSocket) client at `createClient()` time even though this app never opens a realtime
  subscription. Node 20 has no global `WebSocket` (added in Node 22), so every client
  construction crashed outright — fixed by passing the `ws` package as the realtime
  transport in all three client-construction call sites, rather than requiring a Node
  upgrade.
- **`computeVenueState()` double-fetched baselines** — a real cost now that each fetch is a
  network round-trip, not a free array filter. Refactored so `computePulseForVenue` and
  `computeVenueState` share one signal-fetch instead of each independently calling
  `listBaselinesForVenue`.

**Verified for real** (see §29 for the equivalent admin-panel pass): ran the actual
`0001_init.sql` migration against a live Supabase project (through both failures above),
ran `npm run seed` to completion against it (140 venues, 874 hours rows, 23,520 baseline
rows, 44 reports, 153 snapshots), then in a real browser against the real database: signup/
login/logout, the map loading real venue clusters with real computed scores, a venue detail
page with a real "why now" explanation and activity chart, submitting a report and having it
correctly recompute the pulse score, the cooldown constraint correctly rejecting a second
report with a friendly 429 (not a raw DB error), and the full admin panel (dashboard metrics,
venue create/edit persisting to Postgres, user promote/demote, self-role-change blocked,
non-admin redirect) — all a second time, after the missing-`await` sweep, to confirm the fix.
