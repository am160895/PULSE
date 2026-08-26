import { describe, expect, it } from "vitest";
import { levelForXp } from "@/lib/gamification/levels";
import { presenceSourceId } from "@/lib/gamification/xp";
import { wasReportConfirmed } from "@/lib/gamification/consensus";
import { buildImpactMessage } from "@/lib/pulse/impactMessage";
import {
  cityScoutQualifies,
  earlySignalEvent,
  firstSignalEvent,
  lineSaverQualifies,
  neighborhoodInsiderAreas,
  nightOwlQualifies,
  onThePulseQualifies,
  trendSpotterQualifies,
} from "@/lib/gamification/badges";
import { CONTRIBUTOR_LEVELS } from "@/config/constants";
import { makeNeighborhoodProgress, makeReport, makeXpEvent } from "./fixtures";

describe("levelForXp", () => {
  it("starts everyone at Explorer with 0 XP", () => {
    const level = levelForXp(0);
    expect(level.name).toBe("EXPLORER");
    expect(level.nextLevelXp).toBe(100);
  });

  it("stays at the current level right up to the next threshold", () => {
    expect(levelForXp(99).name).toBe("EXPLORER");
    expect(levelForXp(349).name).toBe("SCOUT");
    expect(levelForXp(999).name).toBe("INSIDER");
    expect(levelForXp(2499).name).toBe("LOCAL");
  });

  it("advances exactly at each threshold", () => {
    expect(levelForXp(100).name).toBe("SCOUT");
    expect(levelForXp(350).name).toBe("INSIDER");
    expect(levelForXp(1000).name).toBe("LOCAL");
    expect(levelForXp(2500).name).toBe("PULSE_PRO");
  });

  it("has no next level once at the top", () => {
    expect(levelForXp(50_000).nextLevelXp).toBeNull();
  });

  it("thresholds are configurable via CONTRIBUTOR_LEVELS, not hardcoded here", () => {
    expect(CONTRIBUTOR_LEVELS.map((l) => l.minXp)).toEqual([0, 100, 350, 1000, 2500]);
  });
});

describe("presenceSourceId (I'm Here cooldown bucketing)", () => {
  it("produces the same id for two presence taps in the same 25-minute bucket", () => {
    const t1 = new Date("2026-01-02T23:00:00-05:00");
    const t2 = new Date("2026-01-02T23:10:00-05:00");
    expect(presenceSourceId("u1", "v1", t1)).toBe(presenceSourceId("u1", "v1", t2));
  });

  it("produces a different id once the bucket has rolled over", () => {
    const t1 = new Date("2026-01-02T23:00:00-05:00");
    const t2 = new Date(t1.getTime() + 26 * 60_000);
    expect(presenceSourceId("u1", "v1", t1)).not.toBe(presenceSourceId("u1", "v1", t2));
  });

  it("is scoped per user and per venue", () => {
    const t = new Date();
    expect(presenceSourceId("u1", "v1", t)).not.toBe(presenceSourceId("u2", "v1", t));
    expect(presenceSourceId("u1", "v1", t)).not.toBe(presenceSourceId("u1", "v2", t));
  });
});

describe("wasReportConfirmed (delayed accuracy, spec §5/§33)", () => {
  const original = makeReport({ id: "r0", userId: "reporter", crowdLevel: "BUSY", energyLevel: "GOOD", createdAt: "2026-01-02T22:00:00-05:00" });

  function laterReport(id: string, userId: string, minutesAfter: number, crowdLevel: "BUSY" | "PACKED" | "QUIET" = "BUSY") {
    return makeReport({
      id,
      userId,
      crowdLevel,
      energyLevel: "GOOD",
      createdAt: new Date(new Date(original.createdAt).getTime() + minutesAfter * 60_000).toISOString(),
    });
  }

  it("confirms once enough later, independent reports land close to the original value", () => {
    const later = [laterReport("r1", "u1", 5), laterReport("r2", "u2", 10), laterReport("r3", "u3", 15)];
    const result = wasReportConfirmed(original, [original, ...later]);
    expect(result.confirmed).toBe(true);
    expect(result.corroboratingCount).toBe(3);
  });

  it("does not require confirmation with too few corroborating reports", () => {
    const later = [laterReport("r1", "u1", 5), laterReport("r2", "u2", 10)];
    const result = wasReportConfirmed(original, [original, ...later]);
    expect(result.confirmed).toBe(false);
    expect(result.corroboratingCount).toBe(2);
  });

  it("does not count the same user's own later reports as corroboration", () => {
    const later = [laterReport("r1", "reporter", 5), laterReport("r2", "u2", 10), laterReport("r3", "u3", 15)];
    const result = wasReportConfirmed(original, [original, ...later]);
    expect(result.corroboratingCount).toBe(2);
    expect(result.confirmed).toBe(false);
  });

  it("does not count reports that arrived BEFORE the original", () => {
    const earlier = makeReport({ id: "before", userId: "u1", crowdLevel: "BUSY", energyLevel: "GOOD", createdAt: "2026-01-02T21:00:00-05:00" });
    const later = [laterReport("r1", "u1", 5), laterReport("r2", "u2", 10)];
    const result = wasReportConfirmed(original, [original, earlier, ...later]);
    expect(result.corroboratingCount).toBe(2);
  });

  it("does not count reports whose activity value is too far from the original's", () => {
    // BUSY+GOOD vs QUIET+GOOD is a large activity-value gap — directionally different, not confirmation.
    const later = [laterReport("r1", "u1", 5, "QUIET"), laterReport("r2", "u2", 10, "QUIET"), laterReport("r3", "u3", 15, "QUIET")];
    const result = wasReportConfirmed(original, [original, ...later]);
    expect(result.corroboratingCount).toBe(0);
    expect(result.confirmed).toBe(false);
  });
});

describe("buildImpactMessage (spec §32)", () => {
  const base = { pulseScore: 70, pulseLabel: "BUSY" as const, confidenceScore: 60, confidenceLabel: "MEDIUM" as const, freshness: "LIVE" as const, trend: "STABLE" as const, trendDeltaLast30Min: 0, expectedPeak: null, waitEstimate: null, components: [], explanation: "" };

  it("reports a moved score when the score changed materially", () => {
    const impact = buildImpactMessage(base, { ...base, pulseScore: 82 });
    expect(impact.type).toBe("SCORE_MOVED");
    expect(impact.detail).toBe("70 → 82");
  });

  it("reports confirmed confidence when the score barely moved but confidence rose", () => {
    const impact = buildImpactMessage(base, { ...base, pulseScore: 71, confidenceScore: 73 });
    expect(impact.type).toBe("SIGNAL_CONFIRMED");
  });

  it("never manufactures impact when neither score nor confidence moved materially", () => {
    const impact = buildImpactMessage(base, { ...base, pulseScore: 71, confidenceScore: 61 });
    expect(impact.type).toBe("LIVE_SIGNAL_ADDED");
  });
});

describe("badge rules (pure)", () => {
  it("firstSignalEvent picks the earliest report-shaped event, ignoring I_AM_HERE", () => {
    const events = [
      makeXpEvent({ id: "a", rewardType: "I_AM_HERE", createdAt: "2026-01-01T00:00:00Z" }),
      makeXpEvent({ id: "b", rewardType: "CROWD_REPORT", createdAt: "2026-01-02T00:00:00Z" }),
      makeXpEvent({ id: "c", rewardType: "WAIT_REPORT", createdAt: "2026-01-01T12:00:00Z" }),
    ];
    expect(firstSignalEvent(events)?.id).toBe("c");
    expect(firstSignalEvent([])).toBeNull();
  });

  it("lineSaverQualifies requires multiple LONG/VERY_LONG wait reports", () => {
    const two = [
      makeXpEvent({ rewardType: "WAIT_REPORT", metadata: { waitLevel: "LONG" } }),
      makeXpEvent({ rewardType: "WAIT_REPORT", metadata: { waitLevel: "VERY_LONG" } }),
    ];
    expect(lineSaverQualifies(two)).toBe(false);
    expect(lineSaverQualifies([...two, makeXpEvent({ rewardType: "WAIT_REPORT", metadata: { waitLevel: "LONG" } })])).toBe(true);
    expect(lineSaverQualifies([...two, makeXpEvent({ rewardType: "WAIT_REPORT", metadata: { waitLevel: "SHORT" } })])).toBe(false);
  });

  it("nightOwlQualifies only counts events inside the 1-4 AM window", () => {
    const inWindow = Array.from({ length: 5 }, (_, i) => makeXpEvent({ id: `n${i}`, createdAt: `2026-01-03T0${2}:00:00-05:00` }));
    expect(nightOwlQualifies(inWindow)).toBe(true);
    const outsideWindow = Array.from({ length: 5 }, (_, i) => makeXpEvent({ id: `n${i}`, createdAt: `2026-01-02T20:00:00-05:00` }));
    expect(nightOwlQualifies(outsideWindow)).toBe(false);
  });

  it("onThePulseQualifies counts distinct calendar days, not raw event count", () => {
    const sameDay = Array.from({ length: 5 }, (_, i) => makeXpEvent({ id: `d${i}`, createdAt: "2026-01-02T20:00:00-05:00" }));
    expect(onThePulseQualifies(sameDay)).toBe(false);
    const threeDays = [
      makeXpEvent({ id: "d1", createdAt: "2026-01-02T20:00:00-05:00" }),
      makeXpEvent({ id: "d2", createdAt: "2026-01-09T20:00:00-05:00" }),
      makeXpEvent({ id: "d3", createdAt: "2026-01-16T20:00:00-05:00" }),
    ];
    expect(onThePulseQualifies(threeDays)).toBe(true);
  });

  it("cityScoutQualifies requires XP in multiple neighborhoods, zero-XP rows don't count", () => {
    const two = [makeNeighborhoodProgress({ neighborhood: "West Village", xp: 20 }), makeNeighborhoodProgress({ neighborhood: "SoHo", xp: 0 })];
    expect(cityScoutQualifies(two)).toBe(false);
    const three = [...two.slice(0, 1), makeNeighborhoodProgress({ neighborhood: "SoHo", xp: 10 }), makeNeighborhoodProgress({ neighborhood: "LES", xp: 5 })];
    expect(cityScoutQualifies(three)).toBe(true);
  });

  it("neighborhoodInsiderAreas returns only neighborhoods past the threshold", () => {
    const areas = neighborhoodInsiderAreas([
      makeNeighborhoodProgress({ neighborhood: "West Village", xp: 200 }),
      makeNeighborhoodProgress({ neighborhood: "SoHo", xp: 50 }),
    ]);
    expect(areas).toEqual(["West Village"]);
  });

  it("trendSpotterQualifies counts SIGNAL_CONFIRMED events tagged as confirmed while rising", () => {
    const events = [
      makeXpEvent({ id: "a", rewardType: "SIGNAL_CONFIRMED", metadata: { trendAtConfirmation: "RISING" } }),
      makeXpEvent({ id: "b", rewardType: "SIGNAL_CONFIRMED", metadata: { trendAtConfirmation: "RISING_FAST" } }),
      makeXpEvent({ id: "c", rewardType: "SIGNAL_CONFIRMED", metadata: { trendAtConfirmation: "STABLE" } }),
    ];
    expect(trendSpotterQualifies(events)).toBe(false);
    expect(trendSpotterQualifies([...events, makeXpEvent({ id: "d", rewardType: "SIGNAL_CONFIRMED", metadata: { trendAtConfirmation: "RISING" } })])).toBe(true);
  });

  it("earlySignalEvent requires the SAME report to be both first-tonight and later confirmed", () => {
    const unrelated = [
      makeXpEvent({ id: "a", rewardType: "FIRST_REPORT_TONIGHT", sourceId: "report-A" }),
      makeXpEvent({ id: "b", rewardType: "SIGNAL_CONFIRMED", sourceId: "report-B" }),
    ];
    expect(earlySignalEvent(unrelated)).toBeNull();

    const matching = [
      makeXpEvent({ id: "a", rewardType: "FIRST_REPORT_TONIGHT", sourceId: "report-A" }),
      makeXpEvent({ id: "b", rewardType: "SIGNAL_CONFIRMED", sourceId: "report-A" }),
    ];
    expect(earlySignalEvent(matching)?.id).toBe("b");
  });
});
