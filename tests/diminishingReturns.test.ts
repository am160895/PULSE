import { describe, expect, it } from "vitest";
import { coverageXpMultiplier } from "@/lib/gamification/diminishingReturns";

describe("coverageXpMultiplier", () => {
  it("is full value (1.0x) for a sparse/DIRECTORY-level venue", () => {
    expect(coverageXpMultiplier(15)).toBe(1);
    expect(coverageXpMultiplier(30)).toBe(1);
  });

  it("floors at 0.5x for a saturated, already-confident venue", () => {
    expect(coverageXpMultiplier(90)).toBe(0.5);
    expect(coverageXpMultiplier(100)).toBe(0.5);
  });

  it("is monotonically non-increasing as confidence rises", () => {
    const samples = [0, 20, 40, 60, 80, 100].map(coverageXpMultiplier);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
  });

  it("never discounts below the 0.5x floor or above 1.0x, even out of range", () => {
    expect(coverageXpMultiplier(-50)).toBe(1);
    expect(coverageXpMultiplier(500)).toBe(0.5);
  });
});
