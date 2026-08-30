# PULSE — Consumer Audit

**Method:** This audit runs every screen and flow through two lenses at once, on purpose, because a
nightlife app that fails the first lens never gets a second chance to be judged by the second one.

1. **A 28-year-old in Manhattan, Friday, 10:45 PM, three friends, already a couple drinks in, patience
   measured in seconds, friends actively arguing about where to go.** This person will not read
   onboarding copy. They will not "explore the app." They have maybe 15-20 seconds to get value before
   the group's attention moves to a group chat, a different app, or just walking toward whatever bar is
   closest.
2. **A world-class consumer marketplace PM and behavioral economist**, evaluating the same product for
   trust calibration, cold-start behavior, incentive alignment, and the gap between what was built and
   what the 10:45 PM person actually needs.

Everything below is evaluated against the product exactly as it exists today per the codebase context
provided: solo-built, unfunded, pre-launch, ~340 real venues mixed with a shrinking set of leftover
synthetic placeholder venues, a handful of manually-created test accounts as the entire "user base,"
anonymous browsing fully coded but dormant because the Supabase toggle hasn't been flipped. No
assumptions beyond that are made; anything not directly evidenced in the codebase description is marked
**[verify]**.

---

## 0. The first 15 seconds — does this survive contact with 10:45 PM Friday?

**It does not get the chance to.** The very first screen a first-time visitor hits is a login/signup
wall. There is no map, no score, no value shown before that. In the 10:45 PM scenario, one friend pulls
out their phone, taps the link/app, and is asked to create an account before anything renders. That
friend says "forget it, let's just walk to [bar they already know]" and the group has moved on before
PULSE showed a single pixel of the thing it's actually good at. This is not a hypothetical risk — it is
the literal current behavior, covered in detail in Section 2.

For the friend who *does* push through registration: no email verification means the account is created
instantly, which is the one mercy here. But "instantly" for an account form is still 20-40 seconds of
typing on a phone with three people talking over you. At 10:45 PM that is an eternity.

**Verdict, persona lens:** dead on arrival for the exact moment the product is supposedly built for.
**Verdict, PM lens:** this is a solvable, already-half-solved problem (see Section 2) — but until it's
solved, every other feature in this audit is graded on a product that, in production today, nobody
un-registered can even see.

---

## 1. Screen-by-screen / flow-by-flow evaluation

### 1.1 The live map

- **Can I understand it instantly?** The core visual language (a map with colored/scored pins) is
  genuinely one of the more instantly-legible patterns in consumer software — this is a real strength.
  Once past the account wall, a 28-year-old does not need an explanation for "map with dots, higher
  number = more happening." That's good, durable UX.
- **Does it answer a real question?** Yes — "what's alive near me right now" is a real, frequently-asked
  question with no clean incumbent answer (Google Maps popular-times is backward-looking-only and not
  bar-specific; Instagram stories are unstructured and effortful to piece together).
- **Does it save me time?** Only if there's enough live data to trust (see 1.5, 3.2). With ~340 real
  venues and a shrinking-but-still-present set of leftover synthetic/placeholder venues, a
  first-time user cannot visually tell a real, current score from a placeholder relic. That is a trust
  tax on every single glance at the map, not just an edge case.
- **Filter chips (Hot now / Rising / Best bet / No line / Friends / Later tonight / venue type):** Good
  instinct — chips are the right interaction pattern for impatient triage. But "No line" is a filter
  chip sitting on top of a schema that has **no entry-friction field at all** — no cover charge, no door
  wait, no guestlist status anywhere on the venue record. So "No line" can only ever be an inference from
  crowd-level reports, not a fact anyone actually reported. A user who taps "No line" expecting a signal
  about the door is being shown a proxy dressed as an answer. This is the single most consequential
  UX-promises-outrun-schema gap in the whole product.

### 1.2 The Pulse Score (0-100) and its breakdown

- The five-signal blend (live reports, historical baseline, momentum vs. the score's own prior history,
  event boost, friends-present boost) is a genuinely sophisticated, well-reasoned scoring design for a
  solo-built project — dynamically re-weighting toward live data as it accumulates, and toward baseline
  when sparse, with a closed-venue force-gate and confidence-gated EMA smoothing. As a behavioral
  economist, this is more rigor than most funded competitors put into a "vibe score."
- **But none of that rigor is visible to the user in the form that matters at 10:45 PM.** There is a
  "plain breakdown list" — i.e., a user who wants to know *why* a score is 72 has to open something and
  read prose-adjacent line items. There is no verdict label (no "GO NOW" / "WAIT IF YOU CAN" / "SKIP
  IT"), no distinct "Move Score" separate from the general Pulse Score, no surfaced "Sweet Spot" concept
  for lively-but-not-slammed. A single integer plus a small trend arrow and delta number is the entire
  at-a-glance signal. That is fine for someone with time to think; it is not a decision-in-3-seconds
  interface, which is exactly the interface this moment requires.
- **Do I trust the number?** Trust is directly proportional to report density, and report density is
  unknown/unproven at real scale — this project has no user-traction evidence of any kind. A
  behavioral-economics read: an opaque single number with no visible confidence indicator invites
  either blind trust (dangerous when data is thin) or reflexive distrust (if it's ever visibly wrong
  once). The product has the underlying confidence score already computed for smoothing — it is not
  exposed to the user at all. That's a missed, cheap trust-building opportunity: even a simple "based on
  2 recent reports" vs. "based on 40 recent reports" caption would recalibrate trust correctly instead of
  implying false certainty.

### 1.3 "Best bet tonight" strip

- Fixed rule: score ≥ 60, open, <3km away, ≥60 min to close. This is a sensible starter heuristic and,
  crucially, an honest one — it's not personalized, and it isn't pretending to be. But it also means it
  cannot answer "best bet for a date" vs. "best bet for six people who want to dance" — it is one strip
  for every user and every intent. At 10:45 PM with an argumentative group of four, a single
  undifferentiated strip is exactly as likely to become the fifth thing they argue about as it is to end
  the argument.
- No personalized ranking exists anywhere in discovery. For a marketplace PM, this is the single biggest
  medium-term opportunity being left on the table, and also entirely reasonable to be missing at this
  stage of a solo pre-launch build — flagging it as a gap, not a failure.

### 1.4 Reporting / contribution flow

- **Does contribution take under 5 seconds?** Submitting a crowd-level + energy-level report is likely a
  low-friction two-tap action **[verify: exact tap count/UI not specified in codebase context above]** —
  the concept is right-sized for the moment. The GPS-proximity-verification and 25-minute cooldown are
  good anti-abuse choices that don't add user-facing friction beyond the first report.
- **Would I contribute?** As the 10:45 PM persona: only if the app already earned enough trust in the
  first 15 seconds to still be open. Contribution is downstream of retention, and retention is currently
  blocked by the registration wall (Section 2). A behavioral-economics note: trust score (0.15-1.0,
  built from confirmation history) is a smart mechanic for weighting long-term reporters, but it does
  nothing for the cold-start problem of a brand-new user's very first report being weighted low by
  definition — there is no visible "your report helped" feedback loop described that would reward that
  first, most-fragile contribution.

### 1.5 Gamification (XP, 9 badges, Founding Scout)

- XP and badges (First Signal, Trend Spotter, Line Saver, Night Owl, On the Pulse, City Scout, Early
  Signal, Neighborhood Insider, Founding Scout) are a reasonable, low-cost retention lever for a solo
  build. Founding Scout — capped at 100, sequentially numbered, gated to genuine contribution rather than
  signup — is a well-designed scarcity mechanic; behaviorally, numbered scarcity ("#47 of 100") is a
  proven driver of early-adopter pride and word-of-mouth, and gating it on real contribution (not just
  signup) avoids the classic exploit of rewarding low-effort account creation.
- **But there is no leaderboard and no team/crew mechanic.** For a product whose entire premise is "a
  group of friends deciding where to go," the absence of any group-facing gamification (e.g., "your crew
  found 12 spots this month") is a mismatch between who uses this product (groups) and what the
  gamification rewards (individuals). This is a real gap, not a nitpick.

### 1.6 Venue ownership / claim flow

- Solid, low-risk feature for a pre-monetization product: claim → admin-approves → private
  single-venue analytics dashboard. No monetization attached to it at all currently (no Stripe, no paid
  tier, no paid placement) — which is honest and appropriate for this stage, but also means there is
  currently zero revenue mechanism anywhere in the product. Worth stating plainly for anyone reading this
  audit expecting a business case: **there is none yet.** This is a product audit, not a business-model
  audit, but the two aren't separable at pre-launch.

### 1.7 Sharing ("share live status")

- Native Web Share API + clipboard fallback, `?src=share` tagging — technically correct, low-effort,
  reasonable default implementation.
- **Would I share this with my friends?** Only once anonymous browsing is live. Today, sharing a link
  sends a friend into the exact same registration wall described in Section 2 before they see the thing
  you wanted to show them. A share flow that dead-ends at a signup form is close to worthless for organic
  growth — the entire value of a share link (frictionless second-hand discovery) is destroyed by the
  first-hand friction it currently forces on the recipient. This is the second-most consequential
  gap in the product after the registration wall itself, and it's the same root cause.
- No group-decision / "where should we go" feature exists. Given the product's own framing (a live map
  meant to settle exactly the argument this persona is having at 10:45 PM), the absence of a
  "send this to the group and vote" mechanic is a surprising gap — it's the most natural viral loop
  available and isn't built.

### 1.8 Admin panel / acquisition-funnel analytics

- Not a consumer-facing surface, so it's graded lightly here, but worth flagging for the PM lens: 13
  named events are tracked with raw all-time counts only — no funnel-conversion math, no cohorting, no
  session/path reconstruction, and the underlying migration for this table **has not been applied to
  production yet**. Translation: as of this audit, the operator cannot currently see even the raw counts
  in production, let alone a real funnel. This matters for the rest of this document because every claim
  in this audit about "would a user do X" is necessarily untested against real behavioral data — there
  isn't any yet, by the project's own description. This audit is a structured prediction, not a
  validated finding, and should be read as such.

---

## 2. The registration wall — called out explicitly, because it changes every answer above

**Today, in production, a first-time visitor cannot see the map, a single Pulse Score, or any venue
information without creating a real email/password account first.** Anonymous/guest browsing was fully
built this session — the code exists, it's presumably tested — but it is dormant because the "Allow
anonymous sign-ins" toggle in the Supabase dashboard has not been flipped by the operator. This is not a
design decision the product is making; it's an unfinished deployment step sitting between the product
and every cold-start user.

- **Would I be annoyed by registration?** Extremely, and specifically at 10:45 PM. Forced signup before
  any value is shown is one of the single most-punished patterns in consumer growth — it converts a
  curiosity click into a bounce, and it converts a friend's shared link into a dead end (see 1.7). This
  is worth stating without hedging: **this is the single highest-leverage fix available in the entire
  product**, and per the codebase context, the supporting code is reportedly already done. Flipping one
  dashboard toggle is described as the entire remaining blocker — that makes this the rare case of a
  five-star problem with a one-star fix. **[verify: confirm no additional production readiness gaps
  exist beyond the toggle before flipping it — e.g., anonymous-session cleanup, rate-limiting for
  unauthenticated report attempts, RLS policies scoped correctly for anon role]**.
- Behaviorally: every day this stays off, the product is being judged (by anyone who tries it) as if
  "requiring an account to see a map" were the intended design, when the codebase context says it isn't.
  That's a reputational cost accruing for free.

---

## 3. Scenario matrix — what actually happens

| Scenario | What happens today | Assessment |
|---|---|---|
| **Little/no live data for nearby venues** | Score leans on historical hourly baseline (day-of-week + hour, interpolated); with the friends-present boost has some cold-start help. Confidence score exists internally but isn't surfaced. | User sees a number with no visible caveat that it's mostly historical, not live. Understated risk of false confidence. |
| **Everything nearby is packed** | No distinct handling — "Hot now" filter surfaces it, but there's no explicit "these are all slammed, here's the next-best-tier further out" reframe. | User has to manually widen search / drop filters. No graceful degradation message. |
| **I want lively but NOT packed** | No "Sweet Spot" concept exists. Best-bet strip uses a single fixed threshold (≥60), not a band. A 95-score mob and a 62-score comfortable buzz look like the same category of "good." | Real, named gap. This is arguably the single most common real intent ("not dead, not a scene") and the product has no concept for it. |
| **On a date** | No filter, mode, or ranking logic distinguishes "date" intent (e.g., quieter, conversation-friendly) from "night out with the group" intent. | Product treats all intents identically; a date-goer gets the same undifferentiated list as a group of six. |
| **Group of six** | No group-decision, voting, or shared-session feature. Six people would each individually browse the same public map and then argue in a group chat, same as they would without the app. | The one moment the product's premise is built for (a group deciding together) has no dedicated flow. |
| **Want dancing** | Venue type is a filter chip, but nothing in the schema captures "has a dance floor" / "DJ tonight" specifically, per the codebase context — this is inferred at best from venue type + energy level reports, not an explicit signal. | Soft gap — proxy exists, explicit signal doesn't. |
| **Hate lines** | "No line" chip exists but there is no door-wait or entry-friction field anywhere on the schema — it's inferred from crowd-level report language/energy at best. | The exact feature this user wants (a reliable line/wait signal) does not structurally exist yet, only a filter label that implies it does. |
| **Willing to travel** | Best-bet strip is hard-capped at <3km; nothing prevents browsing the full map further out, but there's no "worth the trip" surfaced ranking beyond raw score + distance shown per-venue. | Functional but manual; no assistance for the "I don't mind a longer trip for something better" intent. |
| **Unfamiliar with NYC** | No onboarding, no neighborhood framing, no "similar to X you know" comparison — a newcomer sees pins and numbers with zero contextual scaffolding for a city they don't know. | This user is the least served: the product assumes enough local context to interpret a map of unfamiliar neighborhoods. |

---

## 4. Full friction inventory (specific, tied to what's built)

1. **Mandatory account creation before any content renders** — the dominant friction point (Section 2).
2. **Share links dead-end at the same registration wall**, nullifying the primary organic-growth loop.
3. **Real venues are visually indistinguishable from leftover synthetic/placeholder venues** on the map —
   no data-provenance indicator, so a bad first impression (a fake or stale venue) carries full weight.
4. **No visible confidence/data-density indicator** on any Pulse Score, despite the underlying signal
   already being computed server-side for the smoothing logic.
5. **"No line" filter chip implies a signal the schema doesn't actually collect** (no cover/wait/guestlist
   fields exist) — a promise made in the UI that the data model can't back up.
6. **No verdict/decision layer** (no GO NOW / WAIT / SKIP), no Sweet Spot concept, no Move Score distinct
   from Pulse Score — the product stops one layer short of actually making the decision easier; it
   informs, but a tired group at 10:45 PM needs a verdict, not a dataset.
7. **No group-decision or voting mechanic** despite groups being the obvious primary use case.
8. **No entry-friction schema fields** (cover, door wait, guestlist) at all — blocks several stated
   filter promises structurally, not just as a missing UI polish item.
9. **Gamification is entirely individual** — no crew/team mechanic for a fundamentally group-oriented
   product.
10. **The one acquisition-funnel analytics table that would let the operator see any of this happening
    in the wild has not been migrated to production** — meaning these predictions are currently
    untestable against real behavior, which the operator should treat as an urgent, unglamorous
    priority alongside the anonymous-auth toggle.
11. **No personalization anywhere in discovery** — date night, group of six, and solo newcomer all see
    the identical ranked list.
12. **No onboarding/context scaffolding for NYC-unfamiliar users** — the map assumes local knowledge.

---

## Final Consumer Test

**Would a random NYC user open this twice in one month?**
Not as currently deployed. The registration wall means most "randoms" never get a first honest look at
the map at all — the product's real first impression is a signup form, not a live map, and that's the
impression that determines whether there's ever a second open. *If* anonymous browsing were flipped on
tomorrow, the answer improves meaningfully but is still conditional: the core "live map with a score" hook
is strong enough to earn a curious first open, but nothing in the product currently gives a specific
reason to come back a second Friday rather than just reopening Google Maps or Instagram out of habit —
there's no personalization, no saved-venue re-engagement loop beyond a generic "venue saved" event with
no described follow-up, and no notification channel of any kind (no push, no SMS). Repeat use today would
be driven entirely by intrinsic curiosity, not by anything the product does to earn the second visit.

**Would they open it specifically at 10:45 PM Friday — why?**
Only if it's already on their phone, already logged in from a prior session, and they've already
personally verified the data feels current enough to trust once. That's a high bar for a pre-launch,
untested, ~340-real-venue product with no push/SMS to remind them it exists. The moment itself (an
argumentative group needing a fast tiebreaker) is exactly the moment PULSE is designed to win — but
winning it requires the app to already be trusted and already be open, and nothing in the current build
gets it into that position proactively.

**What is currently the strongest reason to open it?**
The live map + Pulse Score concept itself. It answers a real, underserved question ("what's actually
happening right now, near me") with a more thoughtfully-engineered scoring model than the UI lets on, and
the visual pattern (map + score + trend arrow) requires zero explanation to a 28-year-old who's used
consumer map apps before. That core mechanic is genuinely good and is the one thing worth protecting and
building outward from.

**What is missing?**
In order of leverage:
1. **Anonymous browsing actually turned on** — the single highest-leverage, lowest-effort fix available;
   everything else in this document is secondary until this ships.
2. **A group-decision layer** — voting/sharing that resolves an argument between friends, not just a
   single-user map, matching the product's own stated premise.
3. **A visible confidence/data-recency indicator** on scores, to earn trust proportional to actual data
   density instead of implying uniform certainty.
4. **A real entry-friction data field** (cover/wait/guestlist) so "No line" and "hate lines" users get an
   actual answer instead of an inferred proxy.
5. **A verdict layer** (or at minimum a lively-not-packed "sweet spot" band) so the score becomes a
   decision, not just a number to interpret.
6. **Working acquisition-funnel analytics in production**, so every claim in this audit can be replaced
   with a measured one within a month of real traffic.
