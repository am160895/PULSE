import { describe, expect, it } from "vitest";
import { pickDecision } from "@/lib/pulse/decide";
import { makeVenueWithPulse } from "./fixtures";

describe("pickDecision", () => {
  it("returns nothing when there are no candidates at all", () => {
    expect(pickDecision([])).toEqual({ bestMove: null, moreEnergy: null, lessWait: null });
  });

  it("ignores venues Move Score couldn't score (move: null, i.e. CLOSED)", () => {
    const closed = makeVenueWithPulse({ id: "closed", move: null });
    const open = makeVenueWithPulse({ id: "open", move: { moveScore: 50, verdict: "GOOD_MOVE" } });
    const result = pickDecision([closed, open]);
    expect(result.bestMove?.id).toBe("open");
  });

  it("picks the highest Move Score as bestMove", () => {
    const low = makeVenueWithPulse({ id: "low", move: { moveScore: 40, verdict: "GOOD_MOVE" } });
    const high = makeVenueWithPulse({ id: "high", move: { moveScore: 90, verdict: "PEAKING" } });
    const result = pickDecision([low, high]);
    expect(result.bestMove?.id).toBe("high");
  });

  it("offers moreEnergy only when a candidate clears the minimum score delta over bestMove", () => {
    const best = makeVenueWithPulse({ id: "best", move: { moveScore: 70, verdict: "GOOD_MOVE" }, pulse: { ...makeVenueWithPulse().pulse, pulseScore: 60 } });
    const tooClose = makeVenueWithPulse({ id: "close", move: { moveScore: 65, verdict: "GOOD_MOVE" }, pulse: { ...makeVenueWithPulse().pulse, pulseScore: 64 } });
    const noEnergyResult = pickDecision([best, tooClose]);
    expect(noEnergyResult.moreEnergy).toBeNull();

    const genuinelyHotter = makeVenueWithPulse({ id: "hotter", move: { moveScore: 65, verdict: "GOOD_MOVE" }, pulse: { ...makeVenueWithPulse().pulse, pulseScore: 90 } });
    const withEnergyResult = pickDecision([best, tooClose, genuinelyHotter]);
    expect(withEnergyResult.moreEnergy?.id).toBe("hotter");
  });

  it("offers lessWait only when a candidate meaningfully beats bestMove's wait", () => {
    const best = makeVenueWithPulse({
      id: "best",
      move: { moveScore: 70, verdict: "GOOD_MOVE" },
      pulse: { ...makeVenueWithPulse().pulse, waitEstimate: { minMinutes: 20, maxMinutes: 25 } },
    });
    const slightlyBetter = makeVenueWithPulse({
      id: "slightly",
      move: { moveScore: 65, verdict: "GOOD_MOVE" },
      pulse: { ...makeVenueWithPulse().pulse, waitEstimate: { minMinutes: 15, maxMinutes: 20 } },
    });
    const noWaitResult = pickDecision([best, slightlyBetter]);
    expect(noWaitResult.lessWait).toBeNull();

    const muchShorterWait = makeVenueWithPulse({
      id: "shorter",
      move: { moveScore: 60, verdict: "GOOD_MOVE" },
      pulse: { ...makeVenueWithPulse().pulse, waitEstimate: { minMinutes: 2, maxMinutes: 5 } },
    });
    const withWaitResult = pickDecision([best, slightlyBetter, muchShorterWait]);
    expect(withWaitResult.lessWait?.id).toBe("shorter");
  });

  it("never picks bestMove itself as one of the alternates", () => {
    const best = makeVenueWithPulse({ id: "best", move: { moveScore: 95, verdict: "PEAKING" } });
    const result = pickDecision([best]);
    expect(result.moreEnergy).toBeNull();
    expect(result.lessWait).toBeNull();
  });
});
