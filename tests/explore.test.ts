import { describe, expect, it } from "vitest";
import { isBestBetVenue } from "@/lib/pulse/explore";
import { makeVenueWithPulse } from "./fixtures";

const now = new Date("2026-01-02T22:00:00-05:00");

describe("isBestBetVenue", () => {
  it("qualifies a solid, confident, not-closing-soon venue", () => {
    expect(isBestBetVenue(makeVenueWithPulse(), now)).toBe(true);
  });

  it("excludes a venue below the minimum score", () => {
    const v = makeVenueWithPulse({ pulse: { ...makeVenueWithPulse().pulse, pulseScore: 45 } });
    expect(isBestBetVenue(v, now)).toBe(false);
  });

  it("excludes LOW confidence even with a high score", () => {
    const v = makeVenueWithPulse({ pulse: { ...makeVenueWithPulse().pulse, pulseScore: 90, confidenceLabel: "LOW" } });
    expect(isBestBetVenue(v, now)).toBe(false);
  });

  it("excludes a venue falling fast", () => {
    const v = makeVenueWithPulse({ pulse: { ...makeVenueWithPulse().pulse, trend: "FALLING_FAST" } });
    expect(isBestBetVenue(v, now)).toBe(false);
  });

  it("excludes a venue too far away", () => {
    const v = makeVenueWithPulse({ distanceMeters: 5000 });
    expect(isBestBetVenue(v, now)).toBe(false);
  });

  it("includes a venue with no distance info at all (distance filter only applies when known)", () => {
    const v = makeVenueWithPulse({ distanceMeters: undefined });
    expect(isBestBetVenue(v, now)).toBe(true);
  });

  it("excludes a venue closing too soon", () => {
    const v = makeVenueWithPulse({
      openStatus: { ...makeVenueWithPulse().openStatus, closesAt: new Date(now.getTime() + 20 * 60_000).toISOString() },
    });
    expect(isBestBetVenue(v, now)).toBe(false);
  });

  it("includes a venue with no known close time (never penalized for missing data)", () => {
    const v = makeVenueWithPulse({ openStatus: { ...makeVenueWithPulse().openStatus, closesAt: null } });
    expect(isBestBetVenue(v, now)).toBe(true);
  });
});
