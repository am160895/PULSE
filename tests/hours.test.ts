import { describe, expect, it } from "vitest";
import { findOpenWindow } from "@/lib/venues/hours";
import { deriveVenueOpenState } from "@/lib/venues/openState";
import { buildEffectiveHours } from "@/lib/venues/specialHours";
import { getVenueOpenStatus } from "@/lib/venues/getVenueOpenStatus";
import { currentPulseStatusFor } from "@/lib/venues/currentPulseStatus";
import { makeHours, makeSpecialHours } from "./fixtures";

const NY = "America/New_York";
const LA = "America/Los_Angeles";

// Friday (dayOfWeek 5) 5 PM - 3 AM, crossing midnight into Saturday.
const FRI_5PM_3AM = [makeHours({ id: "h", venueId: "v", dayOfWeek: 5, openTime: "17:00", closeTime: "03:00" })];

describe("overnight hours (spec §18)", () => {
  it("is OPEN Friday 11 PM", () => {
    const now = new Date("2026-01-02T23:00:00-05:00"); // Friday
    expect(findOpenWindow(FRI_5PM_3AM, now, NY).isOpenNow).toBe(true);
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, NY)).toBe("OPEN");
  });

  it("is OPEN Saturday 1 AM — Friday's window extends past midnight", () => {
    const now = new Date("2026-01-03T01:00:00-05:00"); // Saturday
    expect(findOpenWindow(FRI_5PM_3AM, now, NY).isOpenNow).toBe(true);
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, NY)).toBe("OPEN");
  });

  it("is still OPEN (closing soon) at Saturday 2:59 AM", () => {
    const now = new Date("2026-01-03T02:59:00-05:00");
    expect(findOpenWindow(FRI_5PM_3AM, now, NY).isOpenNow).toBe(true);
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, NY)).toBe("CLOSING_SOON");
  });

  it("is CLOSED at Saturday 3:01 AM — one minute past close", () => {
    const now = new Date("2026-01-03T03:01:00-05:00");
    expect(findOpenWindow(FRI_5PM_3AM, now, NY).isOpenNow).toBe(false);
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, NY)).toBe("CLOSED");
  });

  it("does not treat close_time earlier than open_time as invalid", () => {
    // 03:00 < 17:00 numerically — must be interpreted as crossing midnight, not rejected.
    const now = new Date("2026-01-03T01:00:00-05:00");
    expect(() => findOpenWindow(FRI_5PM_3AM, now, NY)).not.toThrow();
    expect(findOpenWindow(FRI_5PM_3AM, now, NY).isOpenNow).toBe(true);
  });
});

describe("timezone behavior (spec §19)", () => {
  it("the same UTC instant can be open in one venue timezone and closed in another", () => {
    // Sat 3:30 AM in New York == Sat 12:30 AM in Los Angeles (3 hours behind).
    const now = new Date("2026-01-03T03:30:00-05:00");
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, NY)).toBe("CLOSED");
    expect(deriveVenueOpenState(FRI_5PM_3AM, now, LA)).toBe("OPEN");
  });
});

describe("unknown hours behavior", () => {
  it("reports UNKNOWN when there are no hours on file at all", () => {
    expect(deriveVenueOpenState([], new Date(), NY)).toBe("UNKNOWN");
    const status = getVenueOpenStatus([], [], new Date(), NY, null);
    expect(status.status).toBe("UNKNOWN");
    expect(status.displayText).toBe("Hours unknown");
    expect(status.isOpen).toBe(false);
  });

  it("skips an explicit is_closed row rather than treating it as an all-day window", () => {
    const now = new Date("2026-01-02T12:00:00-05:00"); // Friday noon
    const closedFriday = [makeHours({ id: "h", venueId: "v", dayOfWeek: 5, isClosed: true, openTime: null, closeTime: null })];
    expect(deriveVenueOpenState(closedFriday, now, NY)).toBe("CLOSED");
  });
});

describe("special hours override (spec §20)", () => {
  it("a special-hours closure wins over regular hours that would otherwise be open", () => {
    const now = new Date("2026-01-02T23:00:00-05:00"); // Friday 11 PM — normally open
    const special = [makeSpecialHours({ venueId: "v", specialDate: "2026-01-02", isClosed: true, openTime: null, closeTime: null })];
    const effective = buildEffectiveHours(FRI_5PM_3AM, special, now, NY);
    expect(deriveVenueOpenState(effective, now, NY)).toBe("CLOSED");
  });

  it("a special late-opening window replaces the regular hours entirely for that date", () => {
    // New Year's Eve: regular Friday hours are 5 PM-3 AM, but a special 8 PM-4 AM
    // override should be the one that governs — open at 3:30 AM despite regular hours
    // saying closed by 3 AM, and CLOSED at 6 PM despite regular hours saying open then.
    const special = [makeSpecialHours({ venueId: "v", specialDate: "2026-01-02", isClosed: false, openTime: "20:00", closeTime: "04:00" })];

    const at3am = new Date("2026-01-03T03:00:00-05:00");
    const effectiveAt3am = buildEffectiveHours(FRI_5PM_3AM, special, at3am, NY);
    expect(deriveVenueOpenState(effectiveAt3am, at3am, NY)).toBe("OPEN");

    const at6pm = new Date("2026-01-02T18:00:00-05:00");
    const effectiveAt6pm = buildEffectiveHours(FRI_5PM_3AM, special, at6pm, NY);
    expect(deriveVenueOpenState(effectiveAt6pm, at6pm, NY)).toBe("CLOSED");
  });

  it("does not affect a date with no special-hours row", () => {
    const now = new Date("2026-01-02T23:00:00-05:00");
    const special = [makeSpecialHours({ venueId: "v", specialDate: "2026-06-15", isClosed: true, openTime: null, closeTime: null })];
    const effective = buildEffectiveHours(FRI_5PM_3AM, special, now, NY);
    expect(deriveVenueOpenState(effective, now, NY)).toBe("OPEN");
  });
});

describe("currentPulseStatusFor", () => {
  it("is LIVE for a venue with no hours on file — absence of data is not evidence of closure", () => {
    // calculatePulseScore's own openness gate deliberately treats empty hours as "assume
    // open, don't penalize" (see calculateOpennessSignal) — currentPulseStatus must agree,
    // or a venue with a real computed score would have it hidden behind a false "closed" display.
    expect(currentPulseStatusFor("UNKNOWN")).toBe("LIVE");
  });

  it("is LIVE while genuinely open or closing soon", () => {
    expect(currentPulseStatusFor("OPEN")).toBe("LIVE");
    expect(currentPulseStatusFor("CLOSING_SOON")).toBe("LIVE");
  });

  it("is CLOSED only when there's actual confidence the venue is closed", () => {
    expect(currentPulseStatusFor("CLOSED")).toBe("CLOSED");
    expect(currentPulseStatusFor("TEMPORARILY_CLOSED")).toBe("CLOSED");
    expect(currentPulseStatusFor("PERMANENTLY_CLOSED")).toBe("CLOSED");
  });
});

describe("getVenueOpenStatus (spec §17)", () => {
  // Fresh, admin-verified hours here — a SEED/never-verified source (the FRI_5PM_3AM
  // default) is intentionally LOW confidence and renders "Hours may vary" instead of an
  // Open/Closed line (covered separately below); these tests are about closesAt/opensAt/
  // nextOpenAt correctness, not confidence-driven text, so they need HIGH confidence hours.
  const verifiedNow = new Date("2026-01-02T12:00:00-05:00");
  const FRI_5PM_3AM_VERIFIED = [
    makeHours({ id: "h", venueId: "v", dayOfWeek: 5, openTime: "17:00", closeTime: "03:00", source: "ADMIN", lastVerifiedAt: verifiedNow.toISOString() }),
  ];

  it("reports closesAt/opensAt while open, and null while closed", () => {
    const now = new Date("2026-01-02T23:00:00-05:00");
    const status = getVenueOpenStatus(FRI_5PM_3AM_VERIFIED, [], now, NY, null);
    expect(status.isOpen).toBe(true);
    expect(status.closesAt).not.toBeNull();
    expect(status.opensAt).not.toBeNull();
    expect(status.nextOpenAt).toBeNull();
    expect(status.displayText).toMatch(/^Open/);
  });

  it("reports a nextOpenAt in the future while closed", () => {
    const now = new Date("2026-01-03T10:00:00-05:00"); // Saturday morning, well after close
    const status = getVenueOpenStatus(FRI_5PM_3AM_VERIFIED, [], now, NY, null);
    expect(status.isOpen).toBe(false);
    expect(status.closesAt).toBeNull();
    expect(status.nextOpenAt).not.toBeNull();
    expect(new Date(status.nextOpenAt!).getTime()).toBeGreaterThan(now.getTime());
    expect(status.displayText).toMatch(/^Closed/);
  });

  it("shows HOURS MAY VARY when the source is stale/low-confidence", () => {
    const now = new Date("2026-01-02T23:00:00-05:00");
    const staleHours = [
      makeHours({ id: "h", venueId: "v", dayOfWeek: 5, openTime: "17:00", closeTime: "03:00", source: "SEED", lastVerifiedAt: null }),
    ];
    const status = getVenueOpenStatus(staleHours, [], now, NY, null);
    expect(status.hoursConfidence).toBe("LOW");
    expect(status.displayText).toBe("Hours may vary");
  });

  it("reports HIGH confidence for recently-verified admin-sourced hours", () => {
    const now = new Date("2026-01-02T23:00:00-05:00");
    const freshHours = [
      makeHours({ id: "h", venueId: "v", dayOfWeek: 5, openTime: "17:00", closeTime: "03:00", source: "ADMIN", lastVerifiedAt: new Date(now.getTime() - 24 * 3_600_000).toISOString() }),
    ];
    const status = getVenueOpenStatus(freshHours, [], now, NY, null);
    expect(status.hoursConfidence).toBe("HIGH");
  });

  it("PERMANENTLY_CLOSED and TEMPORARILY_CLOSED override hours entirely", () => {
    const now = new Date("2026-01-02T23:00:00-05:00");
    expect(getVenueOpenStatus(FRI_5PM_3AM, [], now, NY, "CLOSED_PERMANENTLY").status).toBe("PERMANENTLY_CLOSED");
    expect(getVenueOpenStatus(FRI_5PM_3AM, [], now, NY, "CLOSED_TEMPORARILY").status).toBe("TEMPORARILY_CLOSED");
  });
});
