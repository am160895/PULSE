import { describe, expect, it } from "vitest";
import { nightlifeDayParts, previousCalendarDate, formatDate } from "@/lib/time/zoned";
import { calculateVsTypicalSignal } from "@/lib/pulse/signals/vsTypical";

const NY = "America/New_York";

describe("nightlifeDayParts", () => {
  it("keeps 5:59 AM as still belonging to the previous calendar day's night", () => {
    // Saturday 5:59 AM is still Friday night.
    const parts = nightlifeDayParts(new Date("2026-01-03T05:59:00-05:00"), NY);
    expect(parts.nightlifeDate).toBe("2026-01-02"); // Friday
    expect(parts.nightlifeDayOfWeek).toBe(5); // Friday
  });

  it("flips to the new night exactly at the 6 AM boundary", () => {
    const parts = nightlifeDayParts(new Date("2026-01-03T06:00:00-05:00"), NY);
    expect(parts.nightlifeDate).toBe("2026-01-03"); // Saturday
    expect(parts.nightlifeDayOfWeek).toBe(6); // Saturday
  });

  it("during the evening, the nightlife date is just today", () => {
    const parts = nightlifeDayParts(new Date("2026-01-02T22:00:00-05:00"), NY); // Friday 10 PM
    expect(parts.nightlifeDate).toBe("2026-01-02");
    expect(parts.nightlifeDayOfWeek).toBe(5);
  });

  it("handles a month rollover correctly", () => {
    // Feb 1 2026 is a Sunday; 2 AM Feb 1 is still "Saturday night" of Jan 31.
    const parts = nightlifeDayParts(new Date("2026-02-01T02:00:00-05:00"), NY);
    expect(parts.nightlifeDate).toBe("2026-01-31");
    expect(parts.nightlifeDayOfWeek).toBe(6); // Saturday
  });

  it("handles a year rollover correctly", () => {
    // Jan 1 2027 is a Friday; 1 AM Jan 1 is still "Thursday night" of Dec 31, 2026.
    const parts = nightlifeDayParts(new Date("2027-01-01T01:00:00-05:00"), NY);
    expect(parts.nightlifeDate).toBe("2026-12-31");
    expect(parts.nightlifeDayOfWeek).toBe(4); // Thursday
  });

  it("respects a custom boundary hour", () => {
    const at3am = new Date("2026-01-03T03:00:00-05:00");
    expect(nightlifeDayParts(at3am, NY, 4).nightlifeDate).toBe("2026-01-02"); // still previous night at a 4am boundary
    expect(nightlifeDayParts(at3am, NY, 2).nightlifeDate).toBe("2026-01-03"); // already the new night at a 2am boundary
  });
});

describe("previousCalendarDate / formatDate", () => {
  it("rolls back across a month boundary", () => {
    expect(formatDate(previousCalendarDate({ year: 2026, month: 2, day: 1 }))).toBe("2026-01-31");
  });

  it("rolls back across a year boundary", () => {
    expect(formatDate(previousCalendarDate({ year: 2027, month: 1, day: 1 }))).toBe("2026-12-31");
  });

  it("rolls back a normal day", () => {
    expect(formatDate(previousCalendarDate({ year: 2026, month: 1, day: 15 }))).toBe("2026-01-14");
  });
});

function makeRollup(nightlifeDayOfWeek: number, avgPulseScore: number) {
  return {
    id: `r-${Math.random()}`,
    venueId: "v1",
    nightlifeDate: "2026-01-02",
    nightlifeDayOfWeek,
    avgPulseScore,
    peakPulseScore: Math.round(avgPulseScore * 1.2),
    peakAt: null,
    sampleCount: 10,
    reportCount: 2,
    computedAt: new Date().toISOString(),
  };
}

describe("calculateVsTypicalSignal", () => {
  it("returns null with too few sample nights — never a false-precision comparison off thin data", () => {
    const rollups = [makeRollup(5, 50), makeRollup(5, 55)]; // below VS_TYPICAL_MIN_SAMPLE_NIGHTS (3)
    expect(calculateVsTypicalSignal(rollups, 80)).toBeNull();
  });

  it("labels MUCH_BUSIER when current score is far above the typical average", () => {
    const rollups = [makeRollup(5, 50), makeRollup(5, 50), makeRollup(5, 50)];
    const result = calculateVsTypicalSignal(rollups, 90); // +80% vs typical(50)
    expect(result?.label).toBe("MUCH_BUSIER");
    expect(result?.typicalScore).toBe(50);
  });

  it("labels TYPICAL when current score is close to the typical average", () => {
    const rollups = [makeRollup(5, 60), makeRollup(5, 60), makeRollup(5, 60)];
    const result = calculateVsTypicalSignal(rollups, 62); // +3.3%, inside the TYPICAL band
    expect(result?.label).toBe("TYPICAL");
  });

  it("labels MUCH_QUIETER when current score is far below the typical average", () => {
    const rollups = [makeRollup(5, 80), makeRollup(5, 80), makeRollup(5, 80)];
    const result = calculateVsTypicalSignal(rollups, 40); // -50%
    expect(result?.label).toBe("MUCH_QUIETER");
  });

  it("returns null when the typical average is zero — no meaningful percent change to report", () => {
    const rollups = [makeRollup(5, 0), makeRollup(5, 0), makeRollup(5, 0)];
    expect(calculateVsTypicalSignal(rollups, 20)).toBeNull();
  });
});
