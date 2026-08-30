# PULSE — Venue Owner Audit

**Perspective:** Owner/operator of a nightlife venue doing ~$4M annual revenue, evaluating PULSE both as a possible operational tool/vendor and, separately, as a trust-and-safety engineer asking how this product could be turned against my business.

**Scope discipline:** This audit describes PULSE exactly as it is built today — a solo-built, unfunded, pre-launch Next.js/Supabase app with ~340 real geocoded venues (plus leftover synthetic test venues mid-cleanup) and a handful of manually-created test accounts as its entire user base. There is no monetization of any kind (no Stripe, no paid tier, no ads), no demand-gap analytics beyond one incomplete internal dashboard, and no POS/door/ticketing/reservation integrations. Where a capability doesn't exist, this document says so plainly rather than describing a roadmap as if it were shipped.

---

## 1. Why should I care about PULSE at all?

Honestly — today, only marginally, and mostly as a **cheap early-warning claim**, not as a tool.

- It's a live map that scores ~340 NYC/NJ bars 0–100 on a "Pulse Score" blended from live crowd/energy reports, historical hourly baselines, momentum, events, and a friends-present boost. If my venue is in that ~340, someone is already generating a public-facing signal about how busy I am, whether I've claimed my listing or not.
- The only reason to engage now is **defensive and optionality-preserving**: claim my venue (free, admin-approved) so that if this thing ever gets real usage, I'm not finding out from a customer that "PULSE says you're dead tonight" while I have no dashboard, no correction path beyond claiming, and no idea it existed.
- It is not a reason to expect leads, revenue, or operational insight yet. There is no evidence of real user traffic — a handful of test accounts is not traction. Anything beyond "claim it defensively, check back later" would be getting ahead of the product's actual state.

## 2. Does it help me make money? Today — does it, *really*?

**No.** Be precise about why:

- No booking, reservation, ticketing, or table-request flow exists. A user seeing my venue at 78/100 has no in-app way to convert that into a party at my door — there's no "reserve," no "join guestlist," no "buy ticket." The only actions are directions-click, share, save, and "I'm here" (a check-in, not a transaction).
- No monetized placement exists. I cannot pay to appear in "Best bet tonight," cannot pay for a boosted score, cannot buy a featured slot. There is no advertising product to buy even if I wanted to.
- The owner dashboard (once a claim is admin-approved) shows my own venue's Pulse Score, confidence, and trend history — that's descriptive, not prescriptive, and it's about *my own* venue in isolation, not about demand I'm losing to competitors or capturing new customers from.
- The acquisition-funnel dashboard exists in the admin panel but is raw all-time event counts across 13 named events (page views, auth started/completed, report started/completed, shares, saves, directions clicks, friend invites) — no conversion math, no cohorting, no per-venue breakdown, and as of this audit **the underlying database migration for that table hasn't even been applied to production.** It is not a working analytics product right now, for me or for the operator.

So: does PULSE help me make money today? No. It's a discovery surface with no monetization mechanism on either side (mine or the operator's), and no way for me to trace a dollar back to it even informally.

## 3. Could it hurt me?

Yes — and this is the section I care about most as a trust-and-safety engineer, because the abuse surface is real even at pre-launch scale.

**Can users lie about my venue?**
Yes, structurally. A report is crowd level + energy level, nothing more — there's no factual-attribute layer (hours, cover charge, dress code, "is this venue even still open") for a user to falsify beyond the live signal itself, but the live signal *is* exactly what drives the score people see. A user can report high crowd/high energy for an empty room, or dead/low-energy for a packed one. Mitigations that exist: a 25-minute cooldown per (user, venue), GPS-proximity verification (a "verified" flag, not a hard requirement — nothing in the described system blocks a non-verified report from counting, only weights it), and a per-reporter trust score (0.15–1.0) that adjusts on report-confirmation history. That's real friction, but it is not fraud-proofing:
- A brand-new account starts at a default trust weight and can still move the score before the trust system has any history to penalize it on.
- Nothing described prevents someone from being physically present (GPS-verified, high trust) and simply lying about what they see — proximity proves location, not honesty.
- There is no anomaly detection or moderation tooling beyond the trust score and the cooldown. No described mechanism flags a burst of reports from new/low-trust accounts hitting one venue in a short window.

**Can competitors attack my score?**
Nothing in the system distinguishes "customer at a competing bar reporting on my venue for competitive reasons" from an ordinary user. GPS-proximity verification does mean an attacker has to be physically near my venue to get the "verified" weighting — that's a real, non-trivial cost, and it rules out pure remote/bot brigading of the verified path. It does not rule out someone (a competitor, a disgruntled ex-employee, a competitor's staff sent over on a slow night) standing outside or walking in, filing a lowball report, leaving, and repeating after the 25-minute cooldown with a second account. At current volumes this is a low-likelihood, high-slowness attack — but the door is open, and nothing described closes it beyond trust-score damping over time.

**Can I correct inaccurate factual info?**
Partially, and only for the wrong thing. Venue factual fields (address, hours, name, type) are admin-editable and, per the claim flow, an approved owner presumably can request changes — but there's no described self-service edit UI for an owner distinct from viewing the analytics dashboard, and there's no dispute/correction mechanism for the *live score itself*. If the crowd-level signal on my venue is wrong because of bad-faith or mistaken reports, my only recourse today is: wait for the ~3-hour exponential decay to age the reports out, or contact the (single, solo) operator directly. There is no in-app "flag this report" or "request a review" feature for an owner.

**Can I manipulate my own score — and should I be able to?**
I could, mechanically, the same way anyone else can: create accounts (or ask staff/regulars) to file favorable reports. Nothing described technically distinguishes "owner self-boosting" from "genuine patron reporting" — it's the same report pipeline, same trust-score treatment. Should I be able to? No — and to PULSE's credit, nothing in the design *specifically* hands owners a privileged boost lever, which is the right call. But the flip side is that the same lack of an owner-specific channel means I have no *legitimate* fast path to correct a bad-faith dip either. Right now "can I move my own number" and "can I fix a wrong one" are the same unsolved problem: there's no verified, audited, owner-attributed action distinct from an anonymous user report.

**Net risk assessment:** at ~340 venues and a handful of test accounts, the realistic abuse risk to *my* business today is close to zero — there simply isn't enough usage for anyone to bother attacking a score nobody's looking at. The risk is structural and forward-looking: if this reaches even modest real usage without added moderation (report-velocity anomaly detection, an owner dispute channel, multi-account/device correlation), it becomes a low-cost tool for a bad actor to make my venue look dead on a Friday night with no real recourse for me beyond waiting out a decay window.

## 4. What exactly would I pay for, if anything, right now?

Being blunt: **nothing, at a price that isn't essentially symbolic.** There is no feature today that produces a traceable business outcome for me. If forced to name the closest thing to a paid-tier candidate, it would be a fast-tracked or a wait-list-free claim process — and that's not worth money, it's worth an email.

What I would *not* pay for, despite it sounding like a product: the current owner analytics dashboard. It shows my own score/confidence/trend history, which is a mirror of a metric I can already estimate by looking at my own room. It's not benchmarked against nearby competitors, not tied to revenue, and not actionable — there's no "do X and your score/capture would improve" guidance.

## 5. Can I see when potential customers considered me but chose somewhere else?

**No — say so plainly.** The 13 tracked funnel events (VENUE_VIEW, DIRECTIONS_CLICKED, VENUE_SHARED, VENUE_SAVED, etc.) are aggregated **all-time, all-venue** counts in an admin-only dashboard with no per-venue breakdown, no session reconstruction, and no path analysis ("viewed my venue, then viewed and chose a competitor within N minutes"). Even if that migration were applied to production and the dashboard worked exactly as built, it would not answer this question — the data model as described doesn't capture inter-venue comparison behavior at all, only isolated per-event counts. This is a real, meaningful gap for a venue owner: the single most valuable thing a discovery app could tell me — "N people looked at you tonight and went elsewhere, and here's approximately where" — does not exist in any form.

## 6. Can PULSE identify weak demand periods, or demand exceeding my current capture?

**No, not today.** The historical hourly baseline (day-of-week + hour expected activity) is a real, useful primitive — it's built from actual past reports and could, in principle, become the foundation of a "your Tuesdays are structurally weak" or "you're turning away demand on Saturdays after 11pm" insight. But nothing described surfaces that comparison to an owner. The owner dashboard shows my venue's own score/trend, not a demand-vs-capacity view, not a "weak slot" flag, not a benchmark against comparable venues nearby. The raw ingredient (a historical baseline model) exists; the owner-facing insight product built on top of it does not.

## 7. Could it eventually integrate with guest lists / door systems / POS / ticketing / reservations / events? What would that take?

Plausible in direction, unbuilt in every particular. Concretely, today:
- No integrations of any kind exist with any POS, reservation, ticketing, or door/guestlist system. Zero.
- Venue events are handled as a listed-event boost to the Pulse Score (an "event is active/upcoming" signal), which implies a basic events data model already exists — that's the most integration-adjacent thing in the product, and it's still just a boolean/boost input, not a two-way sync with an actual ticketing platform.
- For this to become real, at minimum it would need: (a) an integration/webhook layer that doesn't exist yet (the admin panel today only supports manual venue CRUD and CSV/paste-list bulk import via free Nominatim geocoding — there is no external-API ingestion pattern in the product to extend); (b) a defined per-venue auth/API-key model so a POS or door system could push real occupancy/reservation data in, which has no analog anywhere in the current schema; (c) a business decision about who owns that data contractually, since PULSE has no company entity, no terms of service in evidence, and no vendor agreements referenced anywhere in this project.
- Realistically: this is a multi-quarter build for a team, not a next-sprint feature for a solo operator working session-to-session with an AI assistant. It's a legitimate long-term direction, not a near-term capability, and shouldn't be represented as one when talking to owners.

## 8. What owner feature would create immediate ROI if built next?

Ranked by lowest-effort-to-real-value, given what already exists in the codebase:

1. **A per-venue funnel breakdown, scoped to the owner's own claimed venue, built on the already-collected event data** (once the pending migration is applied). This requires no new instrumentation — the 13 events already fire — just an owner-scoped query and view. This is the cheapest path to finally answering "did people look at me and leave," even partially.
2. **An owner dispute/flag channel for live reports**, closing the biggest trust gap identified in Section 3. Even a simple "flag this report for review → notifies admin" loop would materially improve trust without needing full anomaly-detection infrastructure.
3. **A demand-vs-baseline view**: surface the existing historical hourly baseline against the venue's own recent actuals so an owner can see "you are structurally under-capturing Thursdays 9–11pm" — this reuses the existing baseline model, no new data pipeline needed, and is the first thing that would look like real operational intelligence rather than a mirror.

None of these exist today. All three are compatible with what's already built rather than requiring new architecture.

---

## Ratings (1–10, not inflated)

| Dimension | Score | Why |
|---|---|---|
| **Revenue value** | **1/10** | No monetization mechanism exists on either side of the platform. No traceable path from a Pulse Score view to a dollar in my till. |
| **Operational value** | **3/10** | The historical-baseline concept is a genuinely useful primitive, and the claim/dashboard flow is real, but nothing today converts into an operating decision beyond "look at your own number," which I can already estimate by standing in my own room. |
| **Marketing value** | **2/10** | A public score and a shareable "live status" link are marketing-adjacent, but reach is effectively zero (a handful of test accounts), and I have no control over what the score says about me on a bad-report night. |
| **Trust** | **4/10** | Reasonable first-pass anti-abuse design (decay, cooldown, trust score, proximity flag) for a solo-built pre-launch product, but no moderation tooling, no owner dispute path, and no anomaly detection — trust is earned by low current usage, not by hardened design. |
| **Risk to owner** | **4/10** (low likelihood today, real and unmitigated if usage grows) | Realistic near-term risk is low because almost nobody is using it. Structural risk is meaningfully higher than the current-usage number suggests, because the abuse paths (fake/lowball reports, no dispute channel, no anomaly detection) are all still open. |
| **Willingness to pay** | **1/10** | Nothing built today produces a business outcome worth a recurring invoice. Claiming the venue is worth doing because it's free and defensive; paying anything beyond that isn't justified by anything in the product yet. |

---

## Final Venue Test

Would a bar owner doing $4M/year pay $200/month? $500/month? $1,000/month? For each, name the actual business outcome being bought — not "analytics."

- **$200/month: Not justified.** There is no feature today whose business outcome is worth $2,400/year. The closest candidate — the owner analytics dashboard — shows me my own venue's score history, which I can already sense in real time by being in the building. Paying for a mirror is not a business outcome.

- **$500/month: Not justified — yet, but names the outcome that would earn it.** The outcome that would justify this tier is: *"Tell me, per week, how many people looked at my venue on PULSE and went to a named competitor instead, and tell me which nights I am structurally under-capturing demand I could otherwise be serving."* That requires items #1 and #3 from Section 8 (per-venue funnel breakdown + demand-vs-baseline view) to actually exist and be reliable at real usage volume. Today, neither exists in working form (the funnel table's migration isn't even applied to production), so this tier has no product behind it yet — but it is the correct target to build toward.

- **$1,000/month: Not justified, and further away than $500.** The outcome that would justify this tier is a genuine **integration outcome** — e.g., *"PULSE-driven interest converts into an actual reservation/guestlist add at my door, and I can see the conversion rate,"* or *"PULSE data plugs into my POS/door system so a Pulse-driven surge becomes a staffing and inventory decision I make automatically."* That requires the integration layer described in Section 7, which does not exist today in any form (no API/webhook ingestion pattern, no POS/door/ticketing connector, no company entity or vendor agreement structure to even contract around it). This is a multi-quarter-or-longer build, not a near-term upsell.

**Bottom line:** at current build state, $0/month is the honest price — claiming the venue costs nothing and is worth doing defensively. The path to $500/month is a per-venue demand/funnel product built on data PULSE already collects but doesn't yet expose. The path to $1,000/month requires real integrations that don't exist and haven't been scoped. Anyone quoting a price above $0 today is selling the roadmap, not the product.
