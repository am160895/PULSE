import { describe, expect, it } from "vitest";
import { calculateMoveScore } from "@/lib/pulse/moveScore";
import type { MoveScoreInput } from "@/lib/pulse/moveScore";

function input(overrides: Partial<MoveScoreInput> = {}): MoveScoreInput {
  return {
    pulseScore: 70,
    confidenceScore: 80,
    trend: "STABLE",
    waitEstimate: null,
    currentPulseStatus: "LIVE",
    ...overrides,
  };
}

describe("calculateMoveScore", () => {
  it("is null for a CLOSED venue — there's no 'should we go' question for a place that isn't open", () => {
    expect(calculateMoveScore(input({ currentPulseStatus: "CLOSED", pulseScore: 95 }))).toBeNull();
  });

  it("still scores a DIRECTORY-coverage venue off its baseline reading, same honest signal shown elsewhere", () => {
    const result = calculateMoveScore(input({ pulseScore: 65, confidenceScore: 20 }));
    expect(result).not.toBeNull();
  });

  it("rewards a rising-fast venue over an identical stable one", () => {
    const stable = calculateMoveScore(input({ trend: "STABLE" }))!;
    const risingFast = calculateMoveScore(input({ trend: "RISING_FAST" }))!;
    expect(risingFast.moveScore).toBeGreaterThan(stable.moveScore);
  });

  it("flags HIGH_LINE_RISK once the wait crosses the threshold, regardless of how good the score is", () => {
    const result = calculateMoveScore(input({ pulseScore: 95, trend: "RISING_FAST", waitEstimate: { minMinutes: 25, maxMinutes: 35 } }))!;
    expect(result.verdict).toBe("HIGH_LINE_RISK");
  });

  it("flags COOLING for a venue that was good but is now falling", () => {
    const result = calculateMoveScore(input({ pulseScore: 70, trend: "FALLING_FAST" }))!;
    expect(result.verdict).toBe("COOLING");
  });

  it("flags TOO_EARLY for a low-score venue that's building momentum", () => {
    const result = calculateMoveScore(input({ pulseScore: 20, trend: "RISING" }))!;
    expect(result.verdict).toBe("TOO_EARLY");
  });

  it("flags NOT_WORTH_TRIP for a low final score with no redeeming momentum", () => {
    const result = calculateMoveScore(input({ pulseScore: 15, trend: "FALLING", confidenceScore: 90 }))!;
    expect(result.verdict).toBe("NOT_WORTH_TRIP");
  });

  it("flags PEAKING for an excellent, not-falling score", () => {
    const result = calculateMoveScore(input({ pulseScore: 92, trend: "STABLE", confidenceScore: 95 }))!;
    expect(result.verdict).toBe("PEAKING");
  });

  it("defaults to GOOD_MOVE for a solid, unremarkable venue", () => {
    const result = calculateMoveScore(input({ pulseScore: 65, trend: "STABLE" }))!;
    expect(result.verdict).toBe("GOOD_MOVE");
  });

  it("dampens a low-confidence score toward neutral rather than letting it swing to an extreme", () => {
    const highConfidenceHot = calculateMoveScore(input({ pulseScore: 95, confidenceScore: 100 }))!;
    const lowConfidenceHot = calculateMoveScore(input({ pulseScore: 95, confidenceScore: 0 }))!;
    expect(lowConfidenceHot.moveScore).toBeLessThan(highConfidenceHot.moveScore);
  });

  it("penalizes distance only past the free radius, and never when distance is unknown", () => {
    const unknown = calculateMoveScore(input({ distanceMeters: undefined }))!;
    const near = calculateMoveScore(input({ distanceMeters: 200 }))!;
    const far = calculateMoveScore(input({ distanceMeters: 3000 }))!;
    expect(near.moveScore).toBe(unknown.moveScore);
    expect(far.moveScore).toBeLessThan(near.moveScore);
  });

  it("clamps to 0-100", () => {
    const result = calculateMoveScore(input({ pulseScore: 100, trend: "RISING_FAST", confidenceScore: 100 }))!;
    expect(result.moveScore).toBeLessThanOrEqual(100);
    const low = calculateMoveScore(input({ pulseScore: 0, trend: "FALLING_FAST", confidenceScore: 100, waitEstimate: { minMinutes: 45, maxMinutes: null } }))!;
    expect(low.moveScore).toBeGreaterThanOrEqual(0);
  });
});
