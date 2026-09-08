import { describe, expect, it } from "vitest";
import { deriveSignalHealth } from "@/lib/pulse/signalHealth";
import { TRUST_SCORE_DEFAULT } from "@/config/constants";
import type { VenueHourlyBaseline, VenueReport } from "@/types";
import { makeReport, fridayNightNow } from "./fixtures";

function baselineFor(venueId: string, activity: number): VenueHourlyBaseline[] {
  const rows: VenueHourlyBaseline[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      rows.push({
        id: `${venueId}-${day}-${hour}`,
        venueId,
        dayOfWeek: day,
        hourOfDay: hour,
        expectedActivityScore: activity,
        expectedWaitScore: 0,
        sampleCount: 10,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return rows;
}

const baseInput = {
  friendsPresentCount: 0,
  timezone: "America/New_York",
  trustScores: new Map<string, number>(),
  defaultTrust: TRUST_SCORE_DEFAULT,
};

describe("deriveSignalHealth", () => {
  it("is MIXED with just one recent report — one voice isn't enough to call it LIVE", () => {
    const now = fridayNightNow();
    const reports: VenueReport[] = [makeReport({ createdAt: now.toISOString(), isVerifiedNearby: true })];
    const health = deriveSignalHealth({ ...baseInput, reports, baselines: baselineFor("v1", 50), now });
    expect(health.state).toBe("MIXED");
    expect(health.independentContributors).toBe(1);
  });

  it("is LIVE with 3 independent verified reporters in agreement", () => {
    const now = fridayNightNow();
    const reports: VenueReport[] = Array.from({ length: 3 }, (_, i) =>
      makeReport({
        id: `r${i}`,
        userId: `u${i}`,
        crowdLevel: "BUSY",
        energyLevel: "GOOD",
        isVerifiedNearby: true,
        createdAt: new Date(now.getTime() - i * 60_000).toISOString(),
      })
    );
    const health = deriveSignalHealth({ ...baseInput, reports, baselines: baselineFor("v1", 50), now });
    expect(health.state).toBe("LIVE");
    expect(health.independentContributors).toBe(3);
    expect(health.verifiedContributors).toBe(3);
    expect(health.confidenceLabel).toBe("HIGH");
  });

  it("does not let a single user's multiple reports inflate independentContributors", () => {
    const now = fridayNightNow();
    // Same userId, two different reports — the real 25-min DB cooldown constraint makes
    // this impossible in production; this is purely testing the counting logic itself.
    const reports: VenueReport[] = [
      makeReport({ id: "r1", userId: "same-user", createdAt: now.toISOString() }),
      makeReport({ id: "r2", userId: "same-user", createdAt: new Date(now.getTime() - 5 * 60_000).toISOString() }),
    ];
    const health = deriveSignalHealth({ ...baseInput, reports, baselines: baselineFor("v1", 50), now });
    expect(health.independentContributors).toBe(1);
    expect(health.state).toBe("MIXED");
  });

  it("is EXPECTED with zero live reports but real baseline history", () => {
    const now = fridayNightNow();
    const health = deriveSignalHealth({ ...baseInput, reports: [], baselines: baselineFor("v1", 50), now });
    expect(health.state).toBe("EXPECTED");
    expect(health.independentContributors).toBe(0);
  });

  it("is INSUFFICIENT with zero live reports and no baseline data at all", () => {
    const now = fridayNightNow();
    const health = deriveSignalHealth({ ...baseInput, reports: [], baselines: [], now });
    expect(health.state).toBe("INSUFFICIENT");
  });

  it("caps confidenceLabel below HIGH when source diversity is low, even if the lone report is trusted and verified", () => {
    const now = fridayNightNow();
    const trustScores = new Map([["u1", 1.0]]);
    const reports: VenueReport[] = [makeReport({ userId: "u1", isVerifiedNearby: true, createdAt: now.toISOString() })];
    const health = deriveSignalHealth({ ...baseInput, trustScores, reports, baselines: baselineFor("v1", 50), now });
    expect(health.sourceDiversityScore).toBeLessThan(0.5);
    expect(health.confidenceLabel).not.toBe("HIGH");
  });
});
