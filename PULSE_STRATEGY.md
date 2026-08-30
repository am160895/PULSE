# PULSE — Master Strategy

**Synthesized from four independently-completed audits** (`INVESTOR_AUDIT.md`, `CONSUMER_AUDIT.md`,
`VENUE_OWNER_AUDIT.md`, `COMPETITIVE_MOAT.md`), all written against the same ground truth: a solo-built,
unfunded, pre-launch Next.js 16 + Supabase/Postgres nightlife-discovery app deployed on Railway, with
~340 real geocoded venues (plus a shrinking set of leftover synthetic/placeholder venues), a handful of
manually-created test accounts as the entire "user base," zero revenue, zero monetization code of any
kind, and the single highest-leverage growth lever (anonymous browsing) built but switched off. This
document does not soften that reality anywhere below. Where it proposes something none of the four audits
already established as fact (e.g. the specific wedge geography), it says so explicitly and flags it
**[proposal]** or **[verify]** rather than presenting it as an audited finding.

---

## ONE-SENTENCE PRODUCT

PULSE is a live map that scores NYC/NJ nightlife venues 0–100 from a five-signal blend of crowd-sourced
crowd/energy reports, historical hourly baselines, momentum, event boosts, and friends-present boosts — a
well-engineered scoring pipeline with zero real users, zero revenue, and no proven data moat, not a
company with traction.

---

## CONSUMER JOB TO BE DONE

**Primary job (real, evidenced):** in under 15–20 seconds, tell an impatient person or group whether a
specific venue is worth walking into *right now* — a genuine, frequently-recurring, weekend-concentrated
decision with no clean incumbent answer (Investor Audit §1, §18; Consumer Audit Method).

**Jobs the product does not yet do,** despite being the natural extension of the primary job:
- Settle a group's argument about where to go — no group-decision or voting mechanic exists (Consumer
  Audit §1.5, §3).
- Find "lively but not packed" — no Sweet Spot concept exists; a 95-score mob and a 62-score comfortable
  buzz look like the same category of "good" (Consumer Audit §3).
- Distinguish date-night from group-of-six intent — no personalization exists anywhere in discovery
  (Consumer Audit §1.3, §3).

**The honest complication that overrides all of the above today:** the job cannot even be attempted by a
first-time visitor, because a registration wall blocks any value from rendering before an account exists
(Consumer Audit §0, §2). The job is real; the current production deployment prevents it from being done
at all for anyone who isn't already logged in.

---

## VENUE OWNER JOB TO BE DONE

**Today, honestly:** "let me know, for free, that a public signal about my venue exists somewhere, so a
customer doesn't cite a number I've never seen, and so I hold a claim on record if this ever gets real
usage." That is a defensive, optionality-preserving job — not a growth job (Venue Owner Audit §1, §4).

**Aspirational job, not yet delivered by anything built:** "tell me where I'm losing considered customers
to a named competitor," "tell me which nights I'm structurally under-capturing demand I could otherwise
serve," "let me act on demand signal in real time." None of these are answerable today — the funnel data
is raw all-time counts with no per-venue breakdown or session reconstruction, and the historical baseline
that could power a demand-vs-capacity insight has no owner-facing product built on top of it (Venue Owner
Audit §5, §6).

---

## WHY NOW

- Consumers already trust "a live number replacing a static guess" as a UX pattern from Waze and Google
  Maps traffic/busy-times — PULSE reuses an established mental model rather than inventing one (Investor
  Audit §2, §14 draws this comparison directly).
- Modern serverless tooling plus AI-assisted solo development let one operator ship a five-signal scoring
  pipeline (decay, trust weighting, GPS verification, baseline fallback, confidence-gated smoothing) that
  would previously have required a funded team's quarters of engineering — this lowers the cost of testing
  the core behavioral hypothesis (will people file live reports, repeatedly, forever) to near-zero, which
  is itself the argument for testing it now.
- No incumbent has committed to solving *live, socially-verified, energy-plus-crowd* nightlife signal
  specifically: Google's busyness data is passive aggregate footfall, not opt-in crowd+energy texture
  (Moat Audit §1.1); existing crowdsourced nightlife-heatmap apps win on report density and social graph,
  not necessarily on model sophistication (Moat Audit §1.2). This is a "not worth their attention yet"
  window — real, but explicitly named as fragile the moment PULSE looks big enough to matter (Investor
  Audit §17), not a permanent advantage.
- **[verify]** None of the four audits cite external market-timing evidence (competitor funding, nightlife
  spend data, recovery statistics). This section is a logical argument from the audits' own category
  analysis, not a sourced market-research finding — verify before using it in an external investor
  conversation.

---

## WHY NIGHTLIFE

- A real, recurring, high-frequency decision with no clean incumbent answer (Investor Audit §1, §18).
- The core object — a live, decaying number — is structurally different from the static-directory/review
  model that killed most "Yelp for bars" clones, closer to a live sports score than a listing (Investor
  Audit §3).
- A concentrated, predictable temporal window (weekend nights) makes a geographically narrow wedge
  tractable to reach real density in, versus a diffuse always-on category.
- **Honest structural headwind:** report cadence is capped at roughly one or two nights a week per user,
  which compounds far slower than a daily-use analog like Waze (Investor Audit §14) — a category-level
  ceiling on network-effect velocity, independent of execution quality. Expectations about how fast
  liquidity can be reached should be set against this, not against a daily-use comparable.

---

## WHY PULSE

- The scoring pipeline is the genuine asset today: a five-signal blend (live reports, historical
  baseline, self-referential momentum, event boost, friends-present boost), dynamically reweighted toward
  live data as it accumulates, with closed-venue force-gating and confidence-gated EMA smoothing —
  assessed as "more sophisticated than the category norm" (Investor Audit §1) and "more mathematically
  considered" than the "average the last N check-ins" approach common among peer heatmap apps (Moat Audit
  §1.2).
- The trust-weighted (0.15–1.0), GPS-proximity-verified reporter model is a real anti-gaming design choice
  most peers in this category don't expose or build (Moat Audit §1.1, §1.2).
- **This must always travel with a caveat, because all four audits converge on it independently:** this is
  a code/design-quality advantage, not yet a data advantage. The pipeline runs today on a handful of test
  accounts — none of its sophistication has been perceived by a real user or validated against real
  behavior (Investor Audit §4, §6; Moat Audit §2.1, §2.5). "Why PULSE" is currently a bet on a well-built
  engine, not evidence the engine outperforms a simpler competitor with real data behind it.

---

## WHY NOT GOOGLE

- Google's directory coverage, mapping stack, review volume, and passive aggregate-footfall busyness
  signal (sourced from billions of opted-in devices, requiring zero active user participation) is a
  structural, effectively permanent advantage PULSE cannot contest (Moat Audit §1.1; Investor Audit §2).
- PULSE's only real differentiation claim is the ~3-hour freshness window plus per-reporter trust
  weighting plus event/friends context — none of which Google's aggregate model replicates, because
  Google isn't asking anyone to submit a live crowd+energy report (Investor Audit §2).
- That claim is currently theoretical: with zero real report volume, "PULSE's number is fresher and more
  socially verified than Google's" has never been tested against a real user's judgment. Screenshotted
  side-by-side today, most consumers would shrug (Investor Audit §2).
- Google could ship a surface-level busyness dot in a quarter if nightlife-specific crowd texture ever
  became a priority (Investor Audit §2). PULSE's defensibility here rests on Google's *inattention* to a
  narrow, weekend-concentrated vertical — not on a technical or legal barrier (Investor Audit §17).

---

## WHY NOT EXISTING NIGHTLIFE APPS

- Generic "Yelp for bars" directory clones failed because their core object was a static review with
  weeks of lag; PULSE's core object — a live, decaying number — is a real category distinction (Investor
  Audit §3).
- But PULSE is not automatically ahead of its direct structural analogs: existing crowdsourced-heatmap
  apps that have survived typically win on deeper social graphs or existing report-volume density in a
  specific city (Moat Audit §1.2). PULSE has neither today.
- Sophistication of the algorithm does not substitute for density of input: if a competitor already has
  thousands of nightly reports in Manhattan, PULSE's better math applied to zero reports still loses to
  their worse math applied to real data (Moat Audit §1.2, verbatim finding).
- The gamification layer (XP, 9 badges, Founding Scout) is not a moat versus these peers — badges-for-
  check-ins is a 2010-era Foursquare pattern with a documented history of failing without a social layer,
  which PULSE also hasn't built (Investor Audit §3, §9; Consumer Audit §1.5).

---

## CORE WEDGE

The two-sided liquidity requirement established by the Investor Audit is not a one-time bootstrap: a
venue needs recurring reports *every single Friday/Saturday, indefinitely* to lean on live signal instead
of baseline fallback (Investor Audit §6). The Moat Audit's direct prescription is to "pick a genuinely
narrow beachhead... rather than launching city-wide and thin everywhere" (Moat Audit §1.2). Both point to
the same conclusion: PULSE should not attempt to reach density across NYC/NJ at once.

**Geographic scope [proposal — requires one verification step before finalizing]:** select the single
neighborhood cluster that already has the highest concentration of real (non-synthetic, correctly
geocoded, `neighborhood`/`city`-tagged) venues among the current ~340. This is a direct database query
(`venues` table, filter out synthetic/placeholder rows, group by `neighborhood`) that this document does
not have access to run against production — **[verify: run this query before committing to a specific
neighborhood]**. Illustratively, a single dense Manhattan corridor (e.g. a Lower East Side/East Village
cluster, or a comparably dense pocket — the point is density of *real* venues, not a specific name) is the
right shape of answer; do not substitute a citywide launch for this step.

**Temporal scope:** Friday and Saturday, 10 PM–2 AM only, at launch — matching both the Consumer Audit's
10:45 PM persona and the Investor Audit's "every single Friday/Saturday" liquidity requirement. Every
other night/hour combination is out of scope until this window shows real density.

**Minimum thresholds to call the wedge "genuinely useful" [proposal — design targets to validate, not
audited facts, since no audit supplies a validated number]:**
- **Priority venues:** 25–40 real venues in the wedge neighborhood — small enough for the operator to
  personally hand-verify hours/open-closed accuracy weekly, directly addressing the Investor Audit's
  milestone-5 concern about venue-data accuracy (Investor Audit §5, milestone 5).
- **Active scouts:** a minimum of 3–5 independent reporters per priority venue per peak night — enough
  that one bad-faith or mistaken report can't dominate the blend before trust-score differentiation has
  had time to mature (ties to the abuse-surface finding in Venue Owner Audit §3).
- **Fresh signals:** at least one live report per priority venue per hour across the 10 PM–2 AM window,
  sustained for 4–6 consecutive weekends before evaluating results (mirrors Investor Audit milestones #1
  and #2's 4–6+ / 6–8-weekend thresholds).
- **Sessions:** organic, non-founder, non-seeded sessions only — the Investor Audit is explicit that
  founder-generated traffic doesn't count toward proving the hypothesis (Investor Audit milestone #1).

Do not expand geography until these thresholds are met inside the wedge. If they aren't met after 6–8
weekends, that is itself the answer to the two-sided liquidity question the Investor Audit calls "the
single largest unresolved risk in the business" (Investor Audit §6) — and it should stop further expansion,
not prompt a broader launch.

---

## DATA SUPPLY STRATEGY

Today: 100% self-reported crowd+energy, no other source, no entry-friction fields on the schema at all
(cover/wait/guestlist), no venue integrations of any kind (Investor Audit §6; Moat Audit §2.3; Consumer
Audit friction #8).

**Phase 0 (now):** finish the synthetic/placeholder venue cleanup and validate real-venue accuracy
(hours, open/closed, geocoding), scoped to the Core Wedge neighborhood only — not all of NYC/NJ. A
live-status product that shows wrong hours or dead venues erodes the one thing the entire product bets on
(trust in the number) (Investor Audit §5).

**Phase 1 (0–6 months, inside the wedge only):** grow self-reported supply via the already-built Founding
Scout scarcity mechanic plus anonymous browsing turned on, to lower the participation floor (Investor
Audit §7; Moat Audit §2.6).

**Phase 2 (6–12 months, conditional on Phase 1 showing real density):** add an explicit entry-friction
data field (cover charge, door wait, guestlist status) to the schema, self-reported at first — the
cheapest way to close the gap the Consumer Audit calls the single most consequential UX-promises-outrun-
schema issue in the product: the "No line" filter chip currently implies a signal the schema doesn't
actually collect (Consumer Audit §1.1, friction #5).

**Phase 3 (12+ months, conditional on a committed venue relationship or monetization existing):** pursue
a two-sided venue data exchange (owner-confirmed door counts, POS-derived occupancy) — named by the Moat
Audit as the single most consequential gap for a durable moat (Moat Audit §2.3, §2.7), and by the Venue
Owner Audit as a multi-quarter build requiring an integration/webhook layer, a per-venue API/auth model,
and a company/contract entity, none of which exist today (Venue Owner Audit §7). Do not attempt this
before Phases 1–2 prove the self-reported pipeline actually works — no venue has a reason to integrate
with a data pipeline that hasn't yet proven its own output is valuable.

**Deliberately deferred:** any anomaly-detection/ML fraud system. Report-fraud risk today is low mostly
because there isn't enough usage for anyone to bother attacking a score nobody's looking at (Venue Owner
Audit §3) — building statistical anomaly detection before there's volume for anomalies to be
statistically distinguishable from noise would be solving a problem that doesn't exist yet at the expense
of one that does (see WHAT WE SHOULD BUILD NOW, item 7, for the cheap interim mitigation).

---

## COLD START STRATEGY

1. **Flip the anonymous-browsing toggle** — the single highest-leverage, zero-engineering-cost,
   already-shipped fix identified independently by the Investor and Consumer Audits (Investor Audit §7;
   Consumer Audit §2) — as part of the Core Wedge rollout, not as a separate citywide initiative.
2. **Before flipping it**, complete the readiness check the Consumer Audit explicitly flags:
   anonymous-session cleanup, rate-limiting for unauthenticated report attempts, and RLS policies scoped
   correctly for the anon role (Consumer Audit §2, verify note) — an irresponsibly-flipped toggle could
   compound the report-fraud surface the Venue Owner Audit already flags as unmitigated (Venue Owner Audit
   §3).
3. **Launch Founding Scout concurrently**, scoped only to the wedge's priority venues — the one
   deliberate cold-start growth lever already built (numbered scarcity, gated to genuine contribution, not
   signup) and unlaunched (Investor Audit §7).
4. **Surface the confidence score.** The blend already computes a confidence value internally for
   smoothing but never shows it to the user (Consumer Audit §1.2). Expose it in a lightweight form (e.g.
   "based on 2 recent reports" vs. "based on 40") so cold-start numbers recalibrate trust correctly
   instead of implying false certainty — this directly answers the Investor Audit's concern that "a
   sophisticated user will notice the score never moves" (Investor Audit §7).
5. **Apply the pending analytics migration to production concurrently with the wedge launch**, scoped at
   minimum to reconstruct sessions for the wedge's venues, so the first 4–6 weekends are an instrumented
   experiment, not a soft launch judged by feel (Investor Audit milestone #1; Moat Audit §2.2, §2.6).
6. **Do not attempt city-wide cold start.** Liquidity is two-sided and slow at nightlife's weekend-only
   cadence; spreading first-report effort across all ~340 venues guarantees thin coverage everywhere
   instead of real density anywhere (Moat Audit §1.2; Investor Audit §6).

---

## CONSUMER FLYWHEEL

The two-sided loop (Investor Audit §14): more reporters at a venue → fresher/more-trusted score → more
viewers who trust the score enough to route their night around it → some of those viewers become
reporters when they arrive (via "I'm here") → repeat.

What's needed for each turn to actually engage, per the Consumer Audit:
- **Turn 1** requires anonymous browsing on — a viewer must be able to see the score before they can
  trust it enough to act on it (Consumer Audit §2).
- **Turn 2** requires the share flow to stop dead-ending at the registration wall — currently the
  second-most consequential gap in the product, same root cause as the first (Consumer Audit §1.7).
- **Turn 3** (viewer → reporter) is currently unsupported by any "your report helped" feedback loop — a
  brand-new user's first, most fragile contribution goes unrewarded today (Consumer Audit §1.4).

**Category headwind, repeated honestly:** this flywheel turns roughly once or twice a week per
participant, not daily. Expect it to compound far slower than Waze-style daily-use products, independent
of how well each stage above is executed (Investor Audit §14).

---

## VENUE FLYWHEEL

Today this is not a flywheel — it is a single one-way action: claim → admin-approves → private mirror
dashboard, with no feedback loop back into the product and no monetized reason to re-engage (Venue Owner
Audit §1, §2, §4).

**The flywheel this should become, sequenced behind the consumer flywheel actually working:**
venue claims (defensive, free — today's only real reason to engage) → *[gap: nothing today converts a
claim into re-engagement]* → per-venue funnel view + demand-vs-baseline view ship (Venue Owner Audit §8,
ranked #1 and #3) → owner sees actionable insight for the first time → owner has a reason to check back →
owner is primed to be the first paying pilot (Investor Audit milestone #3) → a paying pilot funds/justifies
a deeper venue-side data exchange (Moat Audit §2.7) → real occupancy data improves that venue's score
accuracy → improved accuracy becomes the pitch to the next venue.

This is a proposed sequence, not a built one — every step past "claims" is aspirational today.

---

## MONETIZATION

Today: literally zero — no Stripe, no subscriptions, no paid placements, no advertising (Investor Audit
§10; Venue Owner Audit ratings; Moat Audit §2.4). Evaluating the eight candidate options against what the
Venue Owner and Investor audits actually found:

| Option | Verdict | Why |
|---|---|---|
| **Venue subscription** | Not now | Venue Owner Audit's own $200/$500/$1,000 test found none justified today; $500/mo becomes viable only once the per-venue funnel + demand-vs-baseline views exist (Venue Owner Audit Final Venue Test). |
| **Promoted placement / boosted score** | Not now; scope strictly later | High trust risk — this is exactly what the Truth Layer/Commercial Layer separation (see MOAT) exists to prevent. A venue must never buy a better Pulse Score. |
| **Sponsored offers** | Not now | Low sales difficulty and low trust risk if clearly labeled, but there's no real audience yet to sell placement against. |
| **Event promotion** | Not now; scope strictly later | The event boost currently feeds the score blend directly — same score-buying risk as promoted placement until the Commercial/Truth separation is built. |
| **Demand-capture campaigns** (pay-per-verified-arrival) | Worth pursuing later | The one shape a real owner explicitly said they'd pay for (Venue Owner Audit §4, $1,000 tier) — but requires the integration layer and company/contract entity that don't exist yet (Venue Owner Audit §7). |
| **Performance-based fees** | Not now | Requires a reserve/guestlist/ticket transaction flow that flatly does not exist (Consumer Audit §1.3; Venue Owner Audit §2). |
| **Aggregate market intelligence** | Not now | Technically closest to what the historical-baseline asset could eventually support, but selling aggregate insight before the underlying data is real is selling a report about noise (Moat Audit §2.7). |
| **API/data licensing** | Not now | Same logic as above, one step further out; also raises the privacy questions the demand graph proposal below would need to resolve first. |

**Overall verdict:** the honest near-term monetization plan is "none, deliberately." The single
highest-leverage step is Investor Audit milestone #3 — land one real paying venue — built on top of the
cheapest real deliverable (the Venue Owner Audit's #1-ranked per-venue funnel view), not any of the eight
options as a general product. Do not build a payments integration before that one deliverable exists to
sell against.

---

## MOAT

The Moat Audit's core verdict stands without softening: "the architecture does not yet build a moat; it
builds the preconditions for one" (Moat Audit §3). The only two assets with real compounding potential are
the historical baseline (once built from real report volume) and the per-reporter trust graph (once it
has real longitudinal history) — both currently near-empty (Moat Audit §2.5). Everything else — UI,
formula, venue list, event counts — is trivially replicable by a competent engineer in weeks (Investor
Audit §4; Moat Audit §2.5).

**SignalProvider pluggable architecture** — named by the Moat Audit as a 12-month-bar precondition, "not
because abstraction itself is a moat, but because it's the precondition for treating the scoring engine as
an asset that could ingest a sixth, genuinely hard-to-get signal... without a rewrite" (Moat Audit §2.6).
**Verdict: worth pursuing later, not now.** With one real signal source (self-reports) and zero venues
integrated, refactoring to a plugin architecture today is premature abstraction — it costs solo-operator
time with no second provider yet to justify the seam. Correct sequencing: after the wedge proves real
report density, before the first venue-integration pilot (Data Supply Strategy Phase 3).

**Truth Layer / Commercial Layer separation** (Pulse Score, momentum, wait, confidence, freshness — never
purchasable — vs. verified listing info, events, offers, sponsored placement, analytics — clearly
labeled, never able to buy a better score). **Verdict: worth adopting now, as a standing engineering rule**,
even with nothing commercial yet to separate. It costs nothing to write down "the score is never
purchasable" before the first monetization stub exists, and it directly prevents the trust-collapse risk
both the Consumer and Investor audits warn about — a single visibly-wrong or manipulated score would
trigger reflexive distrust in the one asset the whole product depends on (Consumer Audit §1.2).

---

## NETWORK EFFECT

The classical two-sided shape (Waze-family): more reporters → fresher score → more viewers → more
reporters (Investor Audit §14). The Moat Audit reinforces that this effect, where it exists among peer
apps, is won on "first-mover density in a specific neighborhood/scene" (Moat Audit §1.2) — meaning the
effect, if it ever forms, is local and per-neighborhood before it is citywide. That is the direct
architectural argument for the Core Wedge above, not a general citywide network effect claim.

Switching cost is honestly near-zero today for consumers, and only mildly nonzero for venue owners out of
habit (Investor Audit §15). The network effect is currently a design shape on paper, not an observed
force — zero real cycles have run (Investor Audit §14).

---

## BIGGEST 10 RISKS

1. The registration wall keeps blocking the product's own core hypothesis from ever being tested (Consumer
   Audit §2; Investor Audit §7) — every risk below is currently unmeasurable because of this one.
2. Two-sided liquidity never reaches real density even in one neighborhood — the standing, indefinite
   Friday/Saturday reporting requirement may simply not be met by real behavior (Investor Audit §6, §18).
3. Building the wrong monetization mechanism first (e.g. score-buying) would destroy trust in the one real
   asset before it's even proven (Investor Audit §10; Moat Audit §2.4).
4. Data-trust erosion from remaining synthetic/placeholder venues or hours/geocoding inaccuracy — a
   live-status product punishes a single wrong impression harder than a static directory does (Investor
   Audit §5; Consumer Audit friction #3).
5. Report fraud / competitor attack surface, with no anomaly detection and no owner dispute channel today
   (Venue Owner Audit §3) — low-likelihood only because usage is near-zero; this risk scales with success.
6. Badges/XP-only retention has a documented history of failing without a social/crew layer PULSE hasn't
   built (Investor Audit §9; Consumer Audit §1.5).
7. The share flow — the primary organic-growth loop — dead-ends at the same registration wall, nullifying
   viral distribution until fixed (Consumer Audit §1.7).
8. Google (or another well-resourced incumbent) deciding nightlife busyness is worth a quarter of
   engineering time — the "not worth their attention" moat is real but fragile and time-limited (Investor
   Audit §17).
9. Solo-operator key-person risk — every mitigation across all four audits is operator-executable, and all
   of it depends on one person's continued time, with no team, no company entity, no succession path (Moat
   Audit §3; Venue Owner Audit §7).
10. Premature scope expansion — building Move Score, Group Pulse, SignalProvider, the demand graph, and
    monetization simultaneously, before the core loop and wedge are validated, would spend the operator's
    only scarce resource (time) on features with no data behind them yet.

---

## MITIGATIONS

1. → Flip anonymous browsing inside the Core Wedge rollout, after the readiness checklist (Cold Start
   Strategy #1–2).
2. → Scope density-seeking to the Core Wedge only; do not expand geography until its minimum thresholds
   are met (Core Wedge; Investor Audit milestone #2).
3. → Adopt the Truth Layer/Commercial Layer rule now, before any monetization code is written (MOAT).
4. → Finish synthetic-venue cleanup and validate accuracy inside the wedge first, not city-wide (Data
   Supply Strategy Phase 0; Investor Audit milestone #5).
5. → Build the cheapest anti-abuse improvement available before opening anonymous access — at minimum an
   owner dispute/flag channel (Venue Owner Audit §8, ranked #2) — reuses existing report data and directly
   addresses the abuse gap every audit calls out.
6. → Do not expand gamification individually; sequence any social/crew mechanic after the consumer
   flywheel's first two turns actually work, rather than adding more individual badges as a retention fix.
7. → Fix the share flow's dead-end as part of the same anonymous-browsing rollout — same root cause, same
   fix (Consumer Audit §1.7).
8. → No code mitigation exists; the only real mitigation is speed — reach real density in the wedge before
   the category looks big enough to draw incumbent attention (Investor Audit §17).
9. → Apply the analytics migration and instrument the wedge properly so validation doesn't depend on the
   operator's personal judgment alone — reduces (does not eliminate) key-person risk.
10. → Use the WHAT WE SHOULD BUILD NOW / NOT BUILD lists below as standing scope discipline, revisited only
    when a milestone is actually hit, not on a fixed calendar.

---

## WHAT WE SHOULD BUILD NOW

Everything here is cheap, already substantially built, or a pure policy/discipline change — no new
architecture:

1. Flip anonymous browsing on, after the readiness checklist (Investor Audit §7; Consumer Audit §2).
2. Apply the pending analytics migration to production, and fix the share-link dead-end — both are
   "finish what's already built," not new work (Investor Audit §8; Consumer Audit §1.7).
3. Finish the synthetic/placeholder venue cleanup, scoped to the Core Wedge neighborhood first (Investor
   Audit §5).
4. Surface the already-computed confidence score to users in a lightweight form — a cheap trust-calibration
   fix the Consumer Audit calls a missed opportunity (Consumer Audit §1.2, friction #4).
5. Launch Founding Scout, scoped to the wedge's priority venues only (Investor Audit §7).
6. Ship the per-venue funnel breakdown for claimed venues — the Venue Owner Audit's #1-ranked, lowest-
   effort item; reuses already-firing events, no new instrumentation (Venue Owner Audit §8).
7. Ship a basic owner dispute/flag channel for live reports — the Venue Owner Audit's #2-ranked item;
   closes the biggest named trust gap cheaply (Venue Owner Audit §8).
8. Adopt the Truth Layer/Commercial Layer separation as a written engineering rule now, even with nothing
   commercial yet to separate (MOAT above).
9. Add a lightweight "your report helped" feedback moment to the reporting flow — closes the cold-start
   contribution gap the Consumer Audit names, without new signal architecture (Consumer Audit §1.4).

---

## WHAT WE SHOULD DELIBERATELY NOT BUILD

1. Any monetization mechanism beyond the one already-cheap venue-funnel deliverable — nothing has earned a
   payment yet (Investor Audit §10; Venue Owner Audit Final Venue Test).
2. A SignalProvider refactor — premature abstraction with only one real signal source today (Moat Audit
   §2.6 sequencing).
3. A demand-vs-baseline owner insight product, Move Score, verdict labels, Sweet Spot band, Best-moves
   top-3 panel, or Group Pulse — all reasonable, all named directly in the founder's own candidate list,
   but every one requires real report density or real usage data to be trustworthy or to design against,
   neither of which exists yet. Building any of them now designs UI for data that isn't there.
4. Any venue-side integration (POS/door/ticketing/reservation) — no company entity, no contract structure,
   no API/auth model exists to build this on; a multi-quarter build for a funded team, not a next-sprint
   item for a solo operator (Venue Owner Audit §7).
5. Any anomaly-detection/fraud-ML system — not enough volume yet for anomalies to be statistically
   meaningful; the cheap dispute channel (BUILD NOW, item 7) is the correctly-sized interim mitigation.
6. City-wide expansion beyond the Core Wedge — every audit converges on narrow beachhead before broad,
   thin coverage (Moat Audit §1.2).
7. Group/crew gamification mechanics beyond what's needed to support the consumer flywheel's viewer→
   reporter turn — don't build a leaderboard system speculatively; badges-alone is already flagged as
   historically weak, and stacking more individual gamification on top doesn't fix that (Investor Audit
   §9).
8. The long-term nightlife demand graph — requires the outcome-tracking and session-reconstruction
   infrastructure that doesn't exist yet even at the event-counting level (Moat Audit §2.2); premature
   until the analytics migration is live and has run for months.

---

## WHAT MUST BE TRUE TO RAISE A SEED ROUND

The Investor Audit already answered this precisely; this document restates its five milestones as the
literal bar rather than re-deriving a softer one:

1. Anonymous browsing flipped on and run for real across 4–6+ consecutive weekends, with the analytics
   migration applied to production.
2. Proven report density (not just existence) across a cluster of venues — multiple independent reporters
   per peak night, sustained for 6–8 consecutive weekends.
3. One real monetization stub with one actual paying venue.
4. Real (non-test-account) week-4/week-8 retention numbers.
5. Finished synthetic-venue cleanup and validated venue-data accuracy across at least one full metro area
   — the Core Wedge, at minimum, per this document's sequencing.

**Connective note:** the Core Wedge strategy above is the concrete mechanism for hitting milestones 1, 2,
and 5 without spreading effort thin across all of NYC/NJ. Hitting them inside one neighborhood first is
compatible with, not a substitute for, the investor audit's bar — the milestones don't ask for citywide
scale, they ask for real, sustained, organic evidence, which is exactly what a validated wedge produces.

---

## Final Investor Test

**Would I invest $1,000,000 of my own money today: NOT YET.** This is a well-engineered algorithm looking
for a market, not yet a business — every dimension that would justify a seed check (real usage, real
retention, a live acquisition funnel, a monetization thesis with code behind it, a data moat beyond an
unpopulated schema) does not exist yet (Investor Audit, Final Investor Test).

**Five milestones to YES** (restated verbatim from the Investor Audit, unchanged by this synthesis):
1. Flip anonymous browsing on and run it for real for 4–6+ weekends with the funnel-analytics migration
   applied to production.
2. Prove sustained multi-reporter density per venue across a cluster of venues, not just isolated
   examples.
3. Land any real monetization stub with one actual paying venue.
4. Show real (non-test-account) week-4/week-8 retention numbers.
5. Finish the synthetic-venue cleanup and validate venue-data accuracy across a full metro area.

None of these require new invention — they require turning on what's already built and observing it for
two to three real months.

---

## Final Consumer Test

**Would a random NYC user open this twice in one month? Not as currently deployed.** The registration
wall means most first-time users never get an honest first look at the map at all — the product's actual
first impression is a signup form, not a live map, and that impression determines whether there's ever a
second open (Consumer Audit, Final Consumer Test).

**In order of leverage, what's missing:**
1. Anonymous browsing actually turned on.
2. A group-decision layer that resolves an argument between friends, matching the product's own stated
   premise.
3. A visible confidence/data-recency indicator on scores.
4. A real entry-friction data field (cover/wait/guestlist).
5. A verdict layer, or at minimum a lively-not-packed "sweet spot" band.
6. Working acquisition-funnel analytics in production, so every claim in the Consumer Audit can be
   replaced with a measured one within a month of real traffic.

---

## Final Venue Test

Would a bar owner doing ~$4M/year pay $200/month? $500/month? $1,000/month? (Venue Owner Audit, Final
Venue Test, restated verbatim):

- **$200/month: Not justified.** No feature today produces a business outcome worth $2,400/year; the
  owner dashboard is a mirror of what an owner can already sense by standing in their own room.
- **$500/month: Not justified — yet, but names the outcome that would earn it** — a per-venue funnel
  breakdown plus a demand-vs-baseline view answering "who looked at me and went to a named competitor
  instead, and which nights am I structurally under-capturing demand." Neither exists in working form
  today.
- **$1,000/month: Not justified, and further away than $500** — requires a genuine integration outcome
  (PULSE-driven interest converting to a real reservation/guestlist add, or PULSE data plugging into a
  POS/door system), which requires an integration layer, and a company/contract entity, that don't exist
  and haven't been scoped.

**Bottom line: the honest current price is $0/month.** Claiming a venue is worth doing defensively because
it's free; anyone quoting a price above $0 today is selling the roadmap, not the product.

---

## Final Rule

PULSE must evolve from **"see which bars are busy"** to **"make the best move right now"** and eventually
to **"route real-world demand."**

- **Consumer value** is better decisions.
- **Venue value** is more captured demand.
- **PULSE value** is proprietary demand intelligence.

Every major product decision should reinforce at least one of these three. Do not add a feature because
it sounds cool. Build an asset.
