import { describe, expect, it } from "vitest";
import { calculateInformationValue } from "@/lib/gamification/informationValue";

const base = {
  pulseScore: 50,
  freshness: "LIVE" as const,
  waitEstimate: { minMinutes: 5, maxMinutes: 15 },
  historicalDemandScore: 30,
  sourceDiversityScore: 0.8,
  agreementScore: 0.9,
};

describe("calculateInformationValue", () => {
  it("returns null for a genuinely well-covered venue", () => {
    expect(calculateInformationValue(base)).toBeNull();
  });

  it("STALE_HIGH_DEMAND: no live signal, but typically busy at this hour", () => {
    const result = calculateInformationValue({ ...base, freshness: "TYPICAL", historicalDemandScore: 75 });
    expect(result?.reasonCode).toBe("STALE_HIGH_DEMAND");
  });

  it("NO_RECENT_SIGNAL: no live signal, and not even typically busy", () => {
    const result = calculateInformationValue({ ...base, freshness: "TYPICAL", historicalDemandScore: 30 });
    expect(result?.reasonCode).toBe("NO_RECENT_SIGNAL");
  });

  it("WAIT_UNKNOWN: live signal exists, but nobody's reported a wait, and it's busy enough to matter", () => {
    const result = calculateInformationValue({ ...base, waitEstimate: null, pulseScore: 60 });
    expect(result?.reasonCode).toBe("WAIT_UNKNOWN");
  });

  it("CONFLICTING_SIGNAL: real reports exist but disagree", () => {
    const result = calculateInformationValue({ ...base, agreementScore: 0.3 });
    expect(result?.reasonCode).toBe("CONFLICTING_SIGNAL");
  });

  it("LOW_SOURCE_DIVERSITY: reports agree, but there's really only one voice", () => {
    const result = calculateInformationValue({ ...base, sourceDiversityScore: 0.1 });
    expect(result?.reasonCode).toBe("LOW_SOURCE_DIVERSITY");
  });

  it("STALE_HIGH_DEMAND takes priority over the generic NO_RECENT_SIGNAL case, never the reverse", () => {
    // Both conditions are technically true here — the more specific/actionable one must win.
    const result = calculateInformationValue({ ...base, freshness: "ESTIMATED", historicalDemandScore: 90 });
    expect(result?.reasonCode).toBe("STALE_HIGH_DEMAND");
  });

  it("valueScore stays within 0-100 across a spread of thin-signal inputs", () => {
    const cases = [
      { ...base, freshness: "TYPICAL" as const, historicalDemandScore: 0 },
      { ...base, freshness: "TYPICAL" as const, historicalDemandScore: 100 },
      { ...base, sourceDiversityScore: 0, agreementScore: 0 },
    ];
    for (const c of cases) {
      const result = calculateInformationValue(c);
      expect(result).not.toBeNull();
      expect(result!.valueScore).toBeGreaterThanOrEqual(0);
      expect(result!.valueScore).toBeLessThanOrEqual(100);
    }
  });
});
