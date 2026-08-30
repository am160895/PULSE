# PULSE — Investor Audit

**Prepared as a seed-stage investment evaluation. $1,000,000 check size assumed.**
**Basis:** actual shipped code as of this audit — Next.js 16 + Supabase/Postgres, deployed on Railway, built solo by one operator in a single long AI-assisted session. No entity, no funding, no other engineers, no real users. A handful of manually created test accounts is the entire "user base." This is evaluated as pre-seed/idea-stage. Any claim of "traction" would be false, and this document does not make one.

---

## 1. Why does this deserve to exist?

The honest answer: it doesn't yet, as a company. As a *product wedge*, there is a real, narrow insight — "is this bar worth walking into right now" is a genuine, repeated, high-frequency decision that no incumbent answers well, and PULSE has actually built the hard part of answering it: `calculatePulseScore.ts` blends live crowd/energy reports (decayed over ~3 hours, weighted by a 0.15–1.0 reporter trust score and GPS-proximity verification), a historical hour/day-of-week baseline, a self-referential momentum term, event boosts, and a friends-present boost, with dynamic reweighting toward live data as it accumulates and a closed-venue force-gate. That's a non-trivial piece of engineering for one person to have shipped. But "deserves to exist" as a venture requires more than a clever scoring function — it requires a reason people will *keep opening it*, and today that reason is unproven. Zero real users have generated zero real report volume. The deserve-to-exist case is a bet on the wedge, not evidence the wedge works.

## 2. Why isn't this a Google Maps feature?

Because Google could ship the surface-level version — a busyness dot on a bar's pin — in a quarter, and arguably already approximates it with the "popular times" and live "how busy" graphs sourced from Android/Location-History aggregate foot traffic. PULSE's actual differentiation from that has to be **the ~3-hour freshness window plus per-reporter trust weighting plus event/friends context**, none of which Google's aggregate-location approach replicates, because Google is modeling historical footfall patterns, not tonight's specific crowd-and-energy texture with a name attached to who reported it. That said: this is a *architecture* difference, not yet a *product* difference a user has ever perceived, because there isn't a single real report in the system yet at any volume. Today, if you screenshotted PULSE's map next to Google's busy-times bar chart, most consumers would shrug. The defensible claim is "we compute a fresher, opt-in, socially-verified number Google structurally can't compute the same way because Google isn't asking anyone to submit a live crowd+energy report." That claim is currently theoretical.

## 3. Why isn't this simply another nightlife app?

The generic "nightlife discovery app" graveyard (countless Yelp-for-bars clones) failed because they were static directories with reviews measured in weeks-old lag. PULSE's structural difference is that its core object is **a live, decaying number**, not a review. That is a real category distinction — closer to a live sports score than a Yelp listing. But the honest caveat: the gamification layer (XP, 9 badges, Founding Scout) is nearly identical in kind to what a dozen failed nightlife/social-discovery apps already tried (badges-for-check-ins is a 2010-era Foursquare pattern that did not, by itself, retain users). If PULSE's pitch reduces to "Foursquare check-ins plus a busyness score," it is not another nightlife app in mechanism, but investors should not let the badge system be mistaken for the moat — the moat, if any exists, is entirely in the scoring pipeline and the report data feeding it, not the gamification chrome.

## 4. What is genuinely proprietary today?

**Be honest: almost nothing is proprietary yet — the proprietary asset is a formula and a pipeline, not data.** There is no protectable IP in the legal sense (no patent, no unique dataset of scale, no trained model with weights that encode learned behavior — `calculatePulseScore.ts` is a hard-coded, deterministic weighted-blend function, not a model). What is proprietary in the "hard to reproduce quickly" sense:
- The specific decay/trust/confidence/momentum weighting logic and the interplay between five hard-coded signals in one file — copyable by a competent engineer in perhaps 1–2 weeks if they saw the spec, faster if they saw the code.
- The historical baseline table, once it has months of real reports behind it — this is the only asset that compounds over time and cannot be reproduced instantly by a copier, because it requires the same months to elapse.
- Nothing else. No proprietary venue dataset (the ~340 venues are geocoded via free Nominatim, a public dataset process, with legacy synthetic/placeholder venues still mid-cleanup — venues themselves are commodity data). No proprietary user graph. No proprietary sensor/hardware integration. No exclusive venue partnerships (zero venues are paying, integrated, or contractually tied to PULSE in any way).

If a competitor had this document, they could rebuild the current feature set in 4-8 weeks with one strong engineer. The only thing they could not rebuild instantly is elapsed time with real report volume — which PULSE also does not yet have.

## 5. What happens if a competitor copies the UI?

Nothing that hurts PULSE, *and nothing that helps them either*, because copying the UI copies zero data. A cloned map-with-filter-chips-and-score-badges app launched tomorrow would have the identical cold-start problem PULSE has today: no reports, no baseline, a force-gated near-zero score on every closed venue and a meaningless one on every open venue with no live reports. UI is not the asset. The risk is not "someone copies our screens," it's "someone reaches critical mass of real live reporters in one neighborhood before we do" — and UI similarity is irrelevant to that race. The real defensibility question is entirely about #6 below.

## 6. Where does real-time data come from, and how much density is required?

Source: exclusively user-submitted reports (crowd level + energy level), decayed over roughly 3 hours, with GPS-proximity verification as the only anti-fraud signal beyond a per-reporter trust score and a 25-minute report cooldown per (user, venue). There is **no other data source** — no POS integration, no door-counter/Wi-Fi-density hardware, no camera, no ticketing/reservation feed, no third-party foot-traffic API blended in. This is a fully crowdsourced, single-source-of-truth model, which is both the entire value proposition and the entire fragility.

Density required: for the blend to lean on live signal instead of the historical baseline (which the algorithm is explicitly designed to fall back to when data is sparse), a venue needs recurring reports *every single Friday/Saturday night, indefinitely* — this is not a one-time bootstrap problem, it's a standing operational requirement. Realistically that means multiple active reporters per popular venue per peak night, sustained forever, in every neighborhood PULSE wants to claim credibility in. With zero real users today, this number is entirely unvalidated. This is the single largest unresolved risk in the business: a two-sided liquidity problem (need reporters to make the score useful, need a useful score to attract reporters/viewers) with no anonymous-browsing funnel live yet to soften it (see #7).

## 7. How does PULSE survive cold start?

Precariously, and today it doesn't yet solve this — it stalls before it. The two mechanisms built to address cold start:
- **Historical baseline fallback**: when live reports are sparse, the algorithm weights toward day-of-week/hour expected activity. This produces a plausible-looking number even with zero live data, which is smart UX (never show "no data") but it is manufactured confidence, not real signal, and a sophisticated user will notice the score never moves.
- **Founding Scout badge**: a scarcity-gamified (limited to 100, sequentially numbered) incentive for early genuine contributors, admin-configurable. This is the one deliberate cold-start growth lever that exists in the product. It is unlaunched and unvalidated — no cohort has ever chased it.

The much larger problem: **the anonymous/guest browsing code is fully built but dormant** — the human operator has not flipped the Supabase "Allow anonymous sign-ins" toggle. Today, a first-time visitor hits an account-creation wall before they can see a single pin on the map. That is close to the worst possible cold-start posture for a network-effects product: the single highest-leverage, already-shipped, zero-engineering-cost fix available (flip one toggle) has not been flipped. Until it is, PULSE cannot even begin measuring real cold-start behavior, let alone solve it.

## 8. What is the acquisition loop?

Instrumented (13 named funnel events: LANDING_VIEW → MAP_VIEW → VENUE_VIEW → SHARED_LINK_OPENED → AUTH_STARTED/COMPLETED → REPORT_STARTED/COMPLETED → IM_HERE_COMPLETED → VENUE_SHARED/SAVED → DIRECTIONS_CLICKED → FRIEND_INVITED) but **not yet functioning as a loop** — the admin dashboard shows raw all-time counts only, no funnel-conversion math, no cohorting, no session/path reconstruction, and the underlying DB migration for this table has not even been applied to production yet. So today there is no measured acquisition loop; there is an intent to build one and a naming scheme for it.

The designed loop, on paper: share-live-status link (native Web Share/clipboard, tagged `?src=share`) → non-account viewer sees a venue's live score/trend/wait → hits the anonymous-browsing wall (currently a hard account wall) → friend-invite. This is a plausible viral-coefficient shape (K-factor from share-link opens converting to new accounts) **but it is entirely unmeasured, and the single biggest lever (frictionless anonymous viewing) is switched off.** There is no paid acquisition, no SEO strategy, no app-store presence discussed anywhere in this codebase.

## 9. What is the retention loop?

XP + 9 badges (First Signal, Trend Spotter, Line Saver, Night Owl, On the Pulse, City Scout, Early Signal, Neighborhood Insider, Founding Scout) plus the intrinsic utility of checking a live map before going out. No leaderboards, no crew/team mechanics, no streaks discussed, no push notifications, no re-engagement messaging beyond a single transactional welcome email. This is a thin retention layer by 2026 consumer-app standards — badges alone have a well-documented history of producing a burst of early engagement that decays without a social or utility layer reinforcing it, and PULSE has the utility half (if the score is actually useful and fresh) but not yet the social half (no crews, no leaderboards, no friend-activity feed beyond a "friends present" boost input). Retention is entirely unmeasured — there is no real cohort to measure it against.

## 10. What is the monetization engine — who pays, why?

**There is none. Be fully honest: zero monetization exists in this product today.** No Stripe integration, no subscriptions, no paid placements, no advertising, no paid tier of any kind, no POS/reservation/ticketing/door-system integration that could carry a transaction fee. Venue claiming exists (owner claims venue, admin approves, owner sees a private one-venue analytics dashboard) but it is entirely free — there is no toggle, code path, or product plan visible anywhere that charges the venue owner for that dashboard. The plausible future monetization shapes — venue-side paid analytics/promoted placement, or consumer-side premium features — are reasonable hypotheses an investor could accept as a thesis, but none has a single line of code behind it. This is the largest gap between "seed-stage idea" and "fundable business" in this audit: there is currently no path from user count to revenue, not even a stub.

## 11. What improves as the network grows?

If it works: (a) live-report density per venue rises, which the algorithm is explicitly built to reward with more live-weighted scores instead of baseline fallback; (b) the historical hourly baseline gets a longer, more accurate window per venue per day-of-week/hour; (c) reporter trust scores mature (more confirmation history = more differentiated 0.15–1.0 weighting), improving anti-gaming resistance; (d) the Founding Scout scarcity mechanic and badge-driven identity accrues social capital for early users that late joiners can't retroactively claim. All four are real, structurally-sound compounding mechanics *in the code*. None has been observed operating at any scale, because there is no scale.

## 12. What becomes harder to copy after 12 months vs. 36 months?

**At 12 months** (assuming real usage exists by then): a competitor still only needs to out-build the code, which is not hard — the harder-to-copy asset is a partial baseline table and a still-small reporter trust graph in a handful of neighborhoods. A well-funded competitor could plausibly out-hustle this by paying for reports/promotions in those same neighborhoods.

**At 36 months**, assuming sustained real usage: the historical baseline becomes a genuinely irreproducible multi-year, per-venue, per-hour dataset that cannot be bought or fast-forwarded, the reporter trust graph becomes deep enough that a new entrant's cold-start trust scores look obviously thin by comparison, and — if the friends-present/crew layer is built out — a social graph switching cost appears that does not exist today. The honest read: the moat, if it ever forms, is time-compounded and currently has had zero months to compound, since there are no real users. Twelve months from now with zero real usage looks identical to zero months from now.

## 13. What data does PULSE uniquely generate?

Today: almost nothing at meaningful volume — a handful of test-account reports. In steady state, if it works: a live, timestamped, geo-verified, trust-weighted crowd-and-energy signal per venue per hour, at a granularity (3-hour decay windows, per-individual GPS-proximity confirmation) that no public dataset (Google's aggregate footfall, Yelp's static reviews) replicates. This would be genuinely unique *if* it existed at scale. It does not exist at scale today.

## 14. The network effect

Two-sided and currently unproven: more reporters at a venue → fresher/more-trusted score → more viewers who trust the score enough to route their night around it → more of those viewers become reporters when they arrive (via the "I'm here" report flow) → repeat. This is a real, classical crowdsourced-marketplace network effect shape (same family as Waze). The risk unique to nightlife versus traffic: report frequency is capped at effectively one or two nights a week (weekend nightlife, not daily commuting), so the effect compounds far slower than a daily-use product like Waze — a structural, category-level headwind independent of execution quality.

## 15. The switching cost

Essentially zero today for a consumer (no crew, no saved social graph beyond a plain "friends" list, no accrued badge identity worth losing at meaningful stakes, no payment/subscription lock-in). For a venue owner who has claimed their venue and grown accustomed to a free analytics dashboard, switching cost is mildly nonzero (habit + a claimed identity) but there's no data export lock-in, no paid contract, nothing structurally sticky. Switching cost, like the moat generally, is a *future* property contingent on badges/crews/history mattering to users — not a present one.

## 16. What prevents disintermediation?

Nothing structural yet. A user could get the same "is it busy" signal from a friend's group chat, from walking past, or from a future Google/Yelp feature, with zero cost to switch away from PULSE, because there is no owned relationship (no paid subscription, no venue integration, no exclusive data venues can only get from PULSE) locking either side in. The only anti-disintermediation asset possible is "our score is measurably better/fresher than the free alternative," which is an execution bet, not a structural one.

## 17. What prevents Google/Yelp/another nightlife app from replicating it?

Nothing legal or technical (no patent, no exclusive data source, no proprietary hardware). What could functionally prevent it: (a) it is a low-priority, low-TAM-looking feature for Google/Yelp specifically because nightlife busyness is a narrow, weekend-concentrated use case unlikely to move their metrics — this is a "not worth their attention" moat, which is real but fragile the moment PULSE looks big enough to matter; (b) speed and focus — a solo/small team can iterate on nightlife-specific UX (friends-present boosts, badges, event boosts) faster than a large incumbent will prioritize a vertical feature. Neither is a durable moat; both are "we might get a head start because nobody bigger cares yet" arguments, which is a real but time-limited category of defensibility.

## 18. What category could PULSE ultimately own?

If the crowdsourced-live-signal mechanic works and generalizes: **"live local capacity/vibe intelligence"** — starting with nightlife (bars/clubs), plausibly extending to any place where "is it worth going right now" is a recurring decision (restaurants without reservations, gyms, beaches, event lines). That is a legitimately large category to aim at. It is also a category no one has won yet specifically because the cold-start/density problem PULSE has not yet solved for its first vertical is the same problem that would need re-solving for every subsequent vertical. Owning "live vibe intelligence" requires first proving the mechanic works in one neighborhood, which has not happened.

---

## Ratings (1–10, not inflated)

| Dimension | Score | Why |
|---|---|---|
| Market opportunity | 5 | Real, recurring decision (nightlife busyness) but a narrow, weekend-concentrated, discretionary-spend category — not a daily-use TAM story until/unless it expands categories. |
| Differentiation | 4 | The scoring pipeline's mechanism is genuinely different from static review apps; but zero live data exists to prove the difference is perceptible to a real user today. |
| Data moat | 2 | Formula, not data. No dataset at any scale exists yet. The moat is entirely hypothetical and time-gated. |
| Network effects | 3 | Correct theoretical shape (two-sided, Waze-like), but weekend-only report cadence structurally slows compounding versus daily-use analogs, and zero real cycles have run. |
| Retention potential | 3 | Badges/XP alone are a known-weak retention mechanic historically; no social/crew layer yet; nothing measured. |
| Consumer acquisition | 2 | Loop is designed (share-link → viewer → invite) but the single highest-leverage lever, frictionless anonymous viewing, is built and switched off; funnel analytics aren't even live in production yet. |
| Monetization | 1 | Literally zero monetization code, plan, or stub exists anywhere in the product today. |
| Defensibility | 2 | No IP, no exclusive data, no contracts, no switching cost today; all defensibility claims are conditional on years of future usage that has not started. |
| Scalability | 5 | The architecture (Next.js/Supabase/Railway) scales technically without difficulty; the bottleneck is entirely the two-sided liquidity problem, not infrastructure. |
| Investability (at this stage, as presented) | 2 | Solo-built, pre-launch, zero users, zero revenue, zero monetization plan, core growth lever unflipped. A real technical asset, but nowhere near a fundable milestone set yet. |

---

## Final Investor Test

**Would I invest $1,000,000 of my own money today: NOT YET.**

Why: this is a well-engineered algorithm looking for a market, not yet a business. The scoring pipeline (`calculatePulseScore.ts`) is genuinely more sophisticated than the category norm, and the founder clearly understands the cold-start and gaming problems well enough to have architected around them (decay, trust weighting, GPS verification, baseline fallback, confidence-gated smoothing). But every dimension that would justify a $1M seed check — real usage, real retention data, a live acquisition funnel, any monetization thesis with code behind it, any data moat beyond an unpopulated table schema — does not exist yet. Investing now would be funding a hypothesis about human behavior (will people file a live crowd report on a Saturday night, repeatedly, forever) that has never once been tested, not funding a business with early signal to scale.

**Five milestones that would move this to YES:**

1. **Flip anonymous browsing on and run it for real** — remove the account wall, and show at least 4–6 consecutive weekends of organic (non-founder, non-seeded) map traffic and report submissions in one real neighborhood, with the funnel-analytics migration actually applied to production so the numbers are trustworthy.
2. **Prove report density, not just report existence** — demonstrate that a meaningful cluster of venues (not a handful of cherry-picked ones) sustains multiple independent live reporters per peak night for at least 6-8 consecutive weekends, i.e., the two-sided liquidity problem is actually solved somewhere, not merely theorized.
3. **Ship any monetization stub with a real venue paying anything** — even one paying venue owner (analytics upsell, promoted placement, anything) turns "no monetization plan" into "an early, testable thesis," which is the single largest gap in this audit.
4. **Show retention beyond week one** — a real (not test-account) cohort with measured week-4 and week-8 return rates, so "retention loop" stops being a design intention and becomes a number.
5. **Clean up the data foundation** — finish purging the leftover synthetic/placeholder venues from the early seed script and demonstrate the venue dataset (density, geocoding accuracy, open/closed accuracy) holds up under real user scrutiny in at least one full metro area, since a live-status product that shows wrong hours or dead venues erodes the one thing (trust in the number) the entire product is betting on.

None of these require new invention — they require **turning on what's already built and observing it for two to three real months.** That is a short, cheap, founder-executable path. Until at least two or three of these five have real data behind them, this is a promising side-project algorithm, not yet an investable company.
