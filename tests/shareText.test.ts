import { describe, expect, it } from "vitest";
import { buildShareStatusText } from "@/lib/share/shareText";

const BASE = {
  venueName: "Ludlow House",
  isDirectory: false,
  isClosed: false,
  pulseScore: 82,
  pulseLabel: "HOT_NOW" as const,
  openStatusText: "Open until 4:00 AM",
  trend: "RISING" as const,
  waitEstimate: { minMinutes: 15, maxMinutes: 25 },
};

describe("buildShareStatusText", () => {
  it("includes venue name, score, label, hours, trend, and wait", () => {
    const text = buildShareStatusText(BASE);
    expect(text).toContain("Ludlow House");
    expect(text).toContain("82");
    expect(text).toContain("Hot now");
    expect(text).toContain("Open until 4:00 AM");
    expect(text).toContain("Rising");
    expect(text).toContain("15–25 min");
  });

  it("omits the wait clause when there's no estimate", () => {
    const text = buildShareStatusText({ ...BASE, waitEstimate: null });
    expect(text).not.toContain("wait");
  });

  it("uses a minimal message for a directory-only venue with no live PULSE", () => {
    const text = buildShareStatusText({ ...BASE, isDirectory: true });
    expect(text).toBe("Check out Ludlow House on PULSE");
  });

  it("uses a closed-venue message without score/trend/wait", () => {
    const text = buildShareStatusText({ ...BASE, isClosed: true, openStatusText: "Closed now" });
    expect(text).toBe("Ludlow House on PULSE — Closed now");
  });
});
