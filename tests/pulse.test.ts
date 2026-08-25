import { describe, expect, it } from "vitest";
import { calculatePulseScore } from "@/lib/pulse/calculatePulseScore";
import { calculateHistoricalSignal } from "@/lib/pulse/signals/historicalBaseline";
import { calculateConfidenceSignal } from "@/lib/pulse/signals/confidence";
import { calculateTrendSignal } from "@/lib/pulse/signals/trend";
import { reportTimeDecay } from "@/lib/pulse/signals/liveReports";
import type { VenueHourlyBaseline, VenueReport, VenueSignalSnapshot } from "@/types";
import { makeReport, makeVenue, fridayNightNow, tuesdayAfternoonNow } from "./fixtures";

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
        expectedWaitScore: Math.max(0, (activity - 40) * 1.4),
        sampleCount: 10,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return rows;
}

const baseInput = {
  venue: makeVenue(),
  events: [],
  friendsPresentCount: 0,
  history: [] as VenueSignalSnapshot[],
  trustScores: new Map<string, number>(),
};

describe("calculatePulseScore", () => {
  it("is always bounded between 0 and 100", () => {
    const now = fridayNightNow();
    const reports: VenueReport[] = Array.from({ length: 20 }, (_, i) =>
      makeReport({ id: `r${i}`, crowdLevel: "PACKED", energyLevel: "VERY_HIGH", createdAt: new Date(now.getTime() - i * 60_000).toISOString(), userId: `u${i}` })
    );
    const result = calculatePulseScore({ ...baseInput, now, reports, baselines: baselineFor("venue-1", 95) });
    expect(result.pulseScore).toBeGreaterThanOrEqual(0);
    expect(result.pulseScore).toBeLessThanOrEqual(100);
  });

  it("does not let a single unverified report push the score to 100", () => {
    const now = tuesdayAfternoonNow();
    const reports = [makeReport({ crowdLevel: "PACKED", energyLevel: "VERY_HIGH", isVerifiedNearby: false, createdAt: now.toISOString() })];
    const result = calculatePulseScore({ ...baseInput, now, reports, baselines: baselineFor("venue-1", 20) });
    expect(result.pulseScore).toBeLessThan(85);
  });

  it("produces a full result with zero live reports, using the historical baseline", () => {
    const now = fridayNightNow();
    const result = calculatePulseScore({ ...baseInput, now, reports: [], baselines: baselineFor("venue-1", 75) });
    expect(result.pulseScore).toBeGreaterThan(0);
    expect(result.confidenceLabel).not.toBe("HIGH"); // no live reports ⇒ never call it HIGH confidence
    expect(result.explanation).toMatch(/no live reports/i);
  });

  it("shows closed venues at 0 regardless of a strong historical baseline", () => {
    const now = fridayNightNow();
    const closedVenue = makeVenue({
      hours: [{ id: "h", venueId: "venue-1", dayOfWeek: now.getDay(), openTime: "09:00", closeTime: "10:00" }],
    });
    const result = calculatePulseScore({ ...baseInput, venue: closedVenue, now, reports: [], baselines: baselineFor("venue-1", 95) });
    expect(result.pulseScore).toBe(0);
  });

  it("can reach the HOT_NOW band when reports, trend, an event, and friend presence all align", () => {
    // Deliberately requires MULTIPLE converging signals (not just a pile of reports) —
    // no single signal type should be able to unilaterally push a venue to HOT_NOW.
    const now = fridayNightNow();
    const trustScores = new Map(Array.from({ length: 10 }, (_, i) => [`u${i}`, 0.85]));
    const reports: VenueReport[] = Array.from({ length: 10 }, (_, i) =>
      makeReport({
        id: `r${i}`,
        crowdLevel: "PACKED",
        energyLevel: "VERY_HIGH",
        waitLevel: "LONG",
        isVerifiedNearby: true,
        createdAt: new Date(now.getTime() - i * 1.5 * 60_000).toISOString(),
        userId: `u${i}`,
      })
    );
    const history: VenueSignalSnapshot[] = [
      { id: "s1", venueId: "venue-1", capturedAt: new Date(now.getTime() - 30 * 60_000).toISOString(), pulseScore: 55, confidenceScore: 70, crowdScore: 55, trendScore: 50, reportScore: 55, historicalScore: 55, eventScore: 50, friendActivityScore: 50, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
      { id: "s2", venueId: "venue-1", capturedAt: new Date(now.getTime() - 5 * 60_000).toISOString(), pulseScore: 96, confidenceScore: 85, crowdScore: 96, trendScore: 95, reportScore: 96, historicalScore: 96, eventScore: 72, friendActivityScore: 66, trendDirection: "RISING_FAST", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
    ];
    const events = [
      { id: "e1", venueId: "venue-1", name: "Guest DJ set", startsAt: new Date(now.getTime() - 20 * 60_000).toISOString(), endsAt: new Date(now.getTime() + 100 * 60_000).toISOString(), eventType: "DJ_SET", source: "SEED", externalUrl: null, createdAt: now.toISOString() },
    ];
    const result = calculatePulseScore({
      ...baseInput,
      now,
      reports,
      baselines: baselineFor("venue-1", 95),
      history,
      events,
      friendsPresentCount: 4,
      trustScores,
    });
    expect(result.pulseScore).toBeGreaterThanOrEqual(90);
    expect(result.pulseLabel).toBe("HOT_NOW");
    expect(result.confidenceLabel).toBe("HIGH");
  });

  it("does NOT reach HOT_NOW from reports alone, with no trend/event/friend support", () => {
    const now = tuesdayAfternoonNow();
    const reports: VenueReport[] = Array.from({ length: 10 }, (_, i) =>
      makeReport({ id: `r${i}`, crowdLevel: "PACKED", energyLevel: "HIGH", isVerifiedNearby: true, createdAt: new Date(now.getTime() - i * 60_000).toISOString(), userId: `u${i}` })
    );
    const result = calculatePulseScore({ ...baseInput, now, reports, baselines: baselineFor("venue-1", 25) });
    expect(result.pulseLabel).not.toBe("HOT_NOW");
  });
});

describe("live report decay", () => {
  it("weighs recent reports far more than old ones", () => {
    expect(reportTimeDecay(0)).toBeCloseTo(1, 2);
    expect(reportTimeDecay(25)).toBeCloseTo(0.5, 2);
    expect(reportTimeDecay(50)).toBeCloseTo(0.25, 2);
  });

  it("treats reports past the irrelevance cutoff as having no effect", () => {
    expect(reportTimeDecay(200)).toBe(0);
  });

  it("makes a 5-minute-old report change the score more than a 90-minute-old one", () => {
    const now = tuesdayAfternoonNow();
    const freshResult = calculatePulseScore({
      ...baseInput,
      now,
      reports: [makeReport({ crowdLevel: "PACKED", energyLevel: "HIGH", createdAt: new Date(now.getTime() - 5 * 60_000).toISOString() })],
      baselines: baselineFor("venue-1", 20),
    });
    const staleResult = calculatePulseScore({
      ...baseInput,
      now,
      reports: [makeReport({ crowdLevel: "PACKED", energyLevel: "HIGH", createdAt: new Date(now.getTime() - 90 * 60_000).toISOString() })],
      baselines: baselineFor("venue-1", 20),
    });
    expect(freshResult.pulseScore).toBeGreaterThan(staleResult.pulseScore);
  });
});

describe("historical baseline signal", () => {
  it("works with an empty report set and returns the looked-up value", () => {
    const now = fridayNightNow();
    const baselines = baselineFor("venue-1", 60);
    const result = calculateHistoricalSignal(baselines, now, "America/New_York");
    expect(result.historicalScore).toBeCloseTo(60, 0);
  });
});

describe("confidence signal", () => {
  it("rises when multiple reports agree", () => {
    const agreeing = calculateConfidenceSignal({ weightedReportCount: 5, agreementScore: 0.95, rawReportCount: 5, verifiedRatio: 0.8, historicalSampleCount: 10 });
    const disagreeing = calculateConfidenceSignal({ weightedReportCount: 5, agreementScore: 0.2, rawReportCount: 5, verifiedRatio: 0.8, historicalSampleCount: 10 });
    expect(agreeing.confidenceScore).toBeGreaterThan(disagreeing.confidenceScore);
  });

  it("never calls history-only confidence HIGH", () => {
    const result = calculateConfidenceSignal({ weightedReportCount: 0, agreementScore: 1, rawReportCount: 0, verifiedRatio: 0, historicalSampleCount: 1000 });
    expect(result.confidenceLabel).not.toBe("HIGH");
  });

  it("rewards verified proximity", () => {
    const verified = calculateConfidenceSignal({ weightedReportCount: 3, agreementScore: 0.8, rawReportCount: 3, verifiedRatio: 1, historicalSampleCount: 5 });
    const unverified = calculateConfidenceSignal({ weightedReportCount: 3, agreementScore: 0.8, rawReportCount: 3, verifiedRatio: 0, historicalSampleCount: 5 });
    expect(verified.confidenceScore).toBeGreaterThan(unverified.confidenceScore);
  });

  it("does not credit a lone report with an agreement bonus it hasn't earned", () => {
    // A single report trivially has zero variance against itself (agreementScore=1) — that
    // must not buy the same confidence boost that real corroboration from a second report would.
    const lone = calculateConfidenceSignal({ weightedReportCount: 0.09, agreementScore: 1, rawReportCount: 1, verifiedRatio: 0, historicalSampleCount: 10 });
    const corroborated = calculateConfidenceSignal({ weightedReportCount: 0.09, agreementScore: 1, rawReportCount: 2, verifiedRatio: 0, historicalSampleCount: 10 });
    expect(corroborated.confidenceScore).toBeGreaterThan(lone.confidenceScore);
    expect(lone.confidenceLabel).toBe("LOW");
  });
});

describe("trend signal", () => {
  it("reports STABLE for small fluctuations", () => {
    const now = new Date();
    const history: VenueSignalSnapshot[] = [
      { id: "a", venueId: "v", capturedAt: new Date(now.getTime() - 30 * 60_000).toISOString(), pulseScore: 60, confidenceScore: 60, crowdScore: 0, trendScore: 0, reportScore: 0, historicalScore: 0, eventScore: 0, friendActivityScore: 0, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
      { id: "b", venueId: "v", capturedAt: now.toISOString(), pulseScore: 61, confidenceScore: 60, crowdScore: 0, trendScore: 0, reportScore: 0, historicalScore: 0, eventScore: 0, friendActivityScore: 0, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
    ];
    const trend = calculateTrendSignal(history, now);
    expect(trend.trendDirection).toBe("STABLE");
  });

  it("reports RISING_FAST for a large positive jump over the window", () => {
    const now = new Date();
    const history: VenueSignalSnapshot[] = [
      { id: "a", venueId: "v", capturedAt: new Date(now.getTime() - 30 * 60_000).toISOString(), pulseScore: 50, confidenceScore: 60, crowdScore: 0, trendScore: 0, reportScore: 0, historicalScore: 0, eventScore: 0, friendActivityScore: 0, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
      { id: "b", venueId: "v", capturedAt: now.toISOString(), pulseScore: 78, confidenceScore: 60, crowdScore: 0, trendScore: 0, reportScore: 0, historicalScore: 0, eventScore: 0, friendActivityScore: 0, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
    ];
    const trend = calculateTrendSignal(history, now);
    expect(trend.trendDirection).toBe("RISING_FAST");
  });

  it("does not fabricate momentum across a large gap in snapshot history", () => {
    // Only snapshot is from 6 hours ago (e.g. venue reopened after being closed, or
    // nobody viewed the page for a while) — comparing "now" to it and calling the result
    // "the last 30 minutes" would invent a trend that never happened.
    const now = new Date();
    const history: VenueSignalSnapshot[] = [
      { id: "a", venueId: "v", capturedAt: new Date(now.getTime() - 6 * 60 * 60_000).toISOString(), pulseScore: 5, confidenceScore: 60, crowdScore: 0, trendScore: 0, reportScore: 0, historicalScore: 0, eventScore: 0, friendActivityScore: 0, trendDirection: "STABLE", waitEstimate: null, expectedPeak: null, signalVersion: 1 },
    ];
    const trend = calculateTrendSignal(history, now);
    expect(trend.trendDirection).toBe("STABLE");
    expect(trend.deltaLast30Min).toBe(0);
  });
});
