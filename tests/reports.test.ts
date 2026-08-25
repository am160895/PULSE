import { describe, expect, it } from "vitest";
import { checkReportCooldown } from "@/lib/reports/cooldown";
import { submitReport } from "@/lib/reports/submitReport";
import { applyTrustAdjustment, detectRepetitivePattern, initialTrustScore } from "@/lib/reports/trust";
import { TRUST_SCORE_MAX, TRUST_SCORE_MIN } from "@/config/constants";

describe("checkReportCooldown", () => {
  it("allows a first-ever report", () => {
    expect(checkReportCooldown(null, new Date()).ok).toBe(true);
  });

  it("blocks a report submitted seconds after the last one", () => {
    const now = new Date();
    const result = checkReportCooldown(new Date(now.getTime() - 30_000), now);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMinutes).toBeGreaterThan(0);
  });

  it("allows a report once the cooldown window has passed", () => {
    const now = new Date();
    const result = checkReportCooldown(new Date(now.getTime() - 26 * 60_000), now);
    expect(result.ok).toBe(true);
  });
});

describe("submitReport", () => {
  const venueLocation = { lat: 40.7357, lng: -74.0036 };
  const validInput = { crowdLevel: "BUSY", waitLevel: "SHORT", energyLevel: "GOOD" };

  it("rejects a report while the user is still in cooldown", () => {
    const now = new Date();
    const result = submitReport(validInput, { venueLocation, lastReportAt: new Date(now.getTime() - 60_000), now, trustWeightAtSubmission: 0.5, source: "APP" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("COOLDOWN");
  });

  it("marks a report verified when the user is within the proximity radius", () => {
    const now = new Date();
    const result = submitReport(
      { ...validInput, userLocation: { lat: 40.7358, lng: -74.0037 } },
      { venueLocation, lastReportAt: null, now, trustWeightAtSubmission: 0.5, source: "APP" }
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.isVerifiedNearby).toBe(true);
  });

  it("does not mark a report verified when far from the venue", () => {
    const now = new Date();
    const result = submitReport(
      { ...validInput, userLocation: { lat: 40.9, lng: -73.8 } },
      { venueLocation, lastReportAt: null, now, trustWeightAtSubmission: 0.5, source: "APP" }
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.isVerifiedNearby).toBe(false);
  });

  it("does not mark a report verified when no location was shared", () => {
    const now = new Date();
    const result = submitReport(validInput, { venueLocation, lastReportAt: null, now, trustWeightAtSubmission: 0.5, source: "APP" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.isVerifiedNearby).toBe(false);
  });

  it("rejects malformed input", () => {
    const now = new Date();
    const result = submitReport({ crowdLevel: "SUPER_PACKED" }, { venueLocation, lastReportAt: null, now, trustWeightAtSubmission: 0.5, source: "APP" });
    expect(result.ok).toBe(false);
  });
});

describe("trust score", () => {
  it("penalizes brand-new accounts relative to the default", () => {
    const now = new Date();
    const brandNew = initialTrustScore(now, now);
    const established = initialTrustScore(new Date(now.getTime() - 30 * 86_400_000), now);
    expect(brandNew).toBeLessThan(established);
  });

  it("keeps trust within [MIN, MAX] after repeated adjustments", () => {
    let score = { userId: "u1", trustScore: 0.5, reportsSubmitted: 0, reportsConfirmed: 0, reportsFlagged: 0, updatedAt: new Date().toISOString() };
    for (let i = 0; i < 50; i++) score = applyTrustAdjustment(score, "FLAGGED");
    expect(score.trustScore).toBeGreaterThanOrEqual(TRUST_SCORE_MIN);
    for (let i = 0; i < 50; i++) score = applyTrustAdjustment(score, "AGREED");
    expect(score.trustScore).toBeLessThanOrEqual(TRUST_SCORE_MAX);
  });

  it("flags identical repeated report values as a suspicious pattern", () => {
    expect(detectRepetitivePattern(["PACKED:NONE:HIGH", "PACKED:NONE:HIGH", "PACKED:NONE:HIGH", "PACKED:NONE:HIGH"])).toBe(true);
    expect(detectRepetitivePattern(["PACKED:NONE:HIGH", "QUIET:NONE:LOW", "BUSY:SHORT:GOOD", "PACKED:NONE:HIGH"])).toBe(false);
  });
});
