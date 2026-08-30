import { describe, expect, it } from "vitest";
import { deriveVenueOpenState } from "@/lib/venues/openState";
import { deriveCoverageState } from "@/lib/venues/coverageState";
import { fridayNightNow, makeHours } from "./fixtures";

const OPEN_ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((d) => makeHours({ id: `h${d}`, venueId: "v", dayOfWeek: d, openTime: "00:00", closeTime: "23:59" }));

describe("deriveVenueOpenState", () => {
  it("reports PERMANENTLY_CLOSED regardless of hours", () => {
    expect(deriveVenueOpenState(OPEN_ALL_WEEK, fridayNightNow(), "America/New_York", "CLOSED_PERMANENTLY")).toBe(
      "PERMANENTLY_CLOSED"
    );
  });

  it("reports TEMPORARILY_CLOSED regardless of hours", () => {
    expect(deriveVenueOpenState(OPEN_ALL_WEEK, fridayNightNow(), "America/New_York", "CLOSED_TEMPORARILY")).toBe(
      "TEMPORARILY_CLOSED"
    );
  });

  it("reports UNKNOWN when there are no hours on file at all", () => {
    expect(deriveVenueOpenState([], fridayNightNow(), "America/New_York")).toBe("UNKNOWN");
  });

  it("reports CLOSED outside the venue's hours", () => {
    const dayHours = [makeHours({ id: "h", venueId: "v", dayOfWeek: fridayNightNow().getDay(), openTime: "09:00", closeTime: "10:00" })];
    expect(deriveVenueOpenState(dayHours, fridayNightNow(), "America/New_York")).toBe("CLOSED");
  });

  it("reports CLOSING_SOON within 30 minutes of close, and OPEN otherwise", () => {
    const now = fridayNightNow(); // 23:30
    const closingSoonHours = [makeHours({ id: "h", venueId: "v", dayOfWeek: now.getDay(), openTime: "20:00", closeTime: "23:45" })];
    const stillOpenHours = [makeHours({ id: "h", venueId: "v", dayOfWeek: now.getDay(), openTime: "20:00", closeTime: "02:00" })];
    expect(deriveVenueOpenState(closingSoonHours, now, "America/New_York")).toBe("CLOSING_SOON");
    expect(deriveVenueOpenState(stillOpenHours, now, "America/New_York")).toBe("OPEN");
  });
});

describe("deriveCoverageState", () => {
  it("is LIVE/RECENT off a fresh report even with zero baseline history — a brand-new venue's first-ever report must never be masked as DIRECTORY just because it hasn't accumulated baselines yet", () => {
    expect(deriveCoverageState(false, "LIVE")).toBe("LIVE");
    expect(deriveCoverageState(false, "RECENT")).toBe("RECENT");
  });

  it("is DIRECTORY only when there's neither a live/recent report nor any baseline data", () => {
    expect(deriveCoverageState(false, "TYPICAL")).toBe("DIRECTORY");
    expect(deriveCoverageState(false, "ESTIMATED")).toBe("DIRECTORY");
  });

  it("maps freshness to coverage state when baseline data exists", () => {
    expect(deriveCoverageState(true, "LIVE")).toBe("LIVE");
    expect(deriveCoverageState(true, "RECENT")).toBe("RECENT");
    expect(deriveCoverageState(true, "ESTIMATED")).toBe("TYPICAL");
    expect(deriveCoverageState(true, "TYPICAL")).toBe("TYPICAL");
  });
});
