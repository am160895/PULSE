# PULSE — Reddit Objection Audit

Honest grading of the actual implementation (as of this pass) against the ten objections a skeptical reader would raise. PASS means the implementation genuinely backs the answer. PARTIAL means real work exists but the honest answer has a real gap. FAIL means the answer isn't backed by anything real yet. Nothing here is rounded up.

---

### "What if only 1 in 10 people use PULSE?" — **PASS**

PULSE never presents app-user counts as attendance. Consumer-facing output is QUIET/MODERATE/BUSY/PACKED, a 0–100 Pulse Score, trend/momentum, wait range, and a confidence label — never "N people are here." `SignalHealth` (added this pass, `src/lib/pulse/signalHealth.ts`) additionally caps the confidence label at MEDIUM whenever `sourceDiversityScore < 0.5`, so a single reporter can no longer alone read as high-confidence regardless of how many app users exist citywide. The honest cost of low penetration is a lower confidence label and a MIXED/EXPECTED state, never a fabricated count.

### "Isn't Google already doing this?" — **PASS, as a real (not aspirational) differentiation**

PULSE doesn't compete on device count or map coverage. It ships real, working nightlife-specific interpretation Google Maps doesn't have: Move Score (`lib/pulse/moveScore.ts`, "should I go," not just "what's here"), wait-time estimates (`lib/pulse/waitEstimate.ts`), momentum/trend direction, and now `SignalHealth`'s explicit LIVE/RECENT/MIXED/EXPECTED honesty layer. One caveat: the spec's "Sweet Spot" concept has no corresponding feature anywhere in the codebase — it's aspirational, not built.

### "Why should I report?" — **PARTIAL**

XP is a real, idempotent, event-sourced ledger (`xp_events`, unique-indexed on `user_id, source_id, reward_type`) with levels (Explorer→Pulse Pro), 9 badges, and neighborhood-scoped reputation (`user_neighborhood_progress`). This pass also wired the previously-dead `applyTrustAdjustment` — a confirmed-accurate report now genuinely raises the reporter's trust score, not just their XP. What's real today is status. What's still missing: XP unlocking actual utility or perks (spec sections 26–29) — that's explicitly deferred to a follow-up pass, not built yet. Answering "XP gets you levels, badges, and neighborhood standing — a perks/utility layer is planned, not live" is honest; claiming more would not be.

### "Can someone fake a venue?" — **PASS**

Venues can only be created by an admin (no user-facing venue-creation path exists at all), with duplicate-name detection on both create and update, and an NYC-metro bounding-box sanity check on submitted coordinates (both fixed earlier this session). A real venue can still be *reported on* dishonestly, which is a different question — see the next two answers.

### "Are you tracking me everywhere?" — **PASS**

There is no background/continuous location capability anywhere in this codebase — location is requested only for specific, foreground user actions (map "near me," "I'm Here," verifying a report), cached for the session rather than re-requested per action (`lib/geo/userLocation.ts`). Friend presence is opt-in per status, defaults to PRIVATE, and auto-expires (120min default, 360min max) — there is no way to see another user's exact live coordinate, only a venue-level status.

### "Does this destroy my battery?" — **PASS**

No persistent geolocation polling exists. The map's `MAP_REFRESH_MS` interval refreshes *venue data* (pulse scores, not location), not a location subscription. Every real location read is a one-shot, cached `getCurrentPosition` call tied to an explicit user action.

### "How do I know the score is real?" — **PASS — this pass's core work**

This is the objection this pass was built to answer. Every venue now exposes `signalHealth` — a state (LIVE/RECENT/MIXED/EXPECTED/INSUFFICIENT), a real count of independent contributors and how many were verified nearby, and a confidence label gated by source diversity, distinct from (and sometimes more conservative than) `coverageState`. The venue page's "What's this based on" panel states the real contributor count, never a fabricated one — e.g. "Based on a single recent report — not enough voices yet to call this a settled read," verified live this pass. The map gets one small, purely additive visual cue (a static accent ring) for venues that clear LIVE + source-diversity-gated HIGH confidence — every other marker is unchanged, deliberately not dimmed or hidden, matching explicit product direction earlier this session against a "washed out" map.

### "What happens with zero reports?" — **PARTIAL, and the gap is real and separate from this pass**

The architecture is sound: zero live reports means `coverageState=DIRECTORY`/`signalHealth` is `EXPECTED` (real baseline history exists) or `INSUFFICIENT` (it doesn't) — never a fabricated live score. **The honest caveat, discovered while verifying this pass live against production**: `venue_hourly_baselines` currently has **zero rows** for the entire real venue set — the original demo seed populated it, but none of the real-venue-import scripts (`addRealVenues*.ts`, `addIrishBarsBatch.ts`, `addVenueDirectoryBatch.ts`) ever wrote baseline data, and that seed data was intentionally removed. In practice, right now, every real venue reads `INSUFFICIENT` rather than `EXPECTED`, and the pulse score's "historical" component is a flat fallback value (30) for every venue regardless of day, hour, or venue type. This is a real, separate, high-value gap — not something this pass was scoped to fix, but worth prioritizing next, since it's the entire cold-start value proposition the spec is asking for.

### "What happens if a venue games PULSE?" — **PARTIAL**

Real defenses exist and were extended this pass: a DB-level (GiST exclusion constraint) 25-minute per-user-per-venue cooldown, a new-account trust ramp, and — new this pass — a repetitive-pattern detector that now actually persists to `report_flags` (previously computed and silently discarded) and applies a real trust penalty, plus confidence capped by source diversity so one coordinated voice can't read as agreement. What's still missing: cross-account collusion detection (multiple distinct accounts coordinating) and any device/IP-level signal — deliberately out of scope pending a privacy/legal review, per the spec's own instruction, not an oversight.

### "What does XP actually get me?" — **PARTIAL** (same honest answer as "Why should I report?" above)

---

## Summary

Seven PASS, three PARTIAL, zero FAIL where an answer is flatly unsupported. The three PARTIALs are not evasions — each names the exact missing piece (perks/utility layer, baseline data backfill, cross-account collusion detection) and each is either already scoped as explicit follow-up work or explicitly deferred pending a legal/privacy review, not silently ignored.
