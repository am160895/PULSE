import { describe, expect, it } from "vitest";
import { mapMarkerClass } from "@/lib/venues/markerColor";
import { makeVenueWithPulse } from "./fixtures";

describe("mapMarkerClass", () => {
  it("is open (green) for a normal live venue with no special tags", () => {
    expect(mapMarkerClass(makeVenueWithPulse())).toBe("open");
  });

  it("is open (green) for a DIRECTORY-coverage venue that's simply open — no live data yet is not the same as closed", () => {
    const v = makeVenueWithPulse({ coverageState: "DIRECTORY" });
    expect(mapMarkerClass(v)).toBe("open");
  });

  it("is closed (grey) for a CLOSED venue, regardless of its pulse label", () => {
    const v = makeVenueWithPulse({
      currentPulseStatus: "CLOSED",
      pulse: { ...makeVenueWithPulse().pulse, pulseLabel: "HOT_NOW" },
    });
    expect(mapMarkerClass(v)).toBe("closed");
  });

  it("is hot (red) for a HOT_NOW venue with a genuine live signal", () => {
    const v = makeVenueWithPulse({ coverageState: "LIVE", pulse: { ...makeVenueWithPulse().pulse, pulseLabel: "HOT_NOW" } });
    expect(mapMarkerClass(v)).toBe("hot");
  });

  it("never shows hot off a DIRECTORY venue's baseline-projected label alone — that would dress up a guess as a confirmed live crowd", () => {
    const v = makeVenueWithPulse({ coverageState: "DIRECTORY", pulse: { ...makeVenueWithPulse().pulse, pulseLabel: "HOT_NOW" } });
    expect(mapMarkerClass(v)).toBe("open");
  });

  it("is irish (orange) for a tagged Irish venue that isn't closed or really busy", () => {
    const v = makeVenueWithPulse({ subcategory: "IRISH" });
    expect(mapMarkerClass(v)).toBe("irish");
  });

  it("prefers hot over the irish tag — a packed Irish pub still reads as really busy", () => {
    const v = makeVenueWithPulse({
      subcategory: "IRISH",
      coverageState: "LIVE",
      pulse: { ...makeVenueWithPulse().pulse, pulseLabel: "HOT_NOW" },
    });
    expect(mapMarkerClass(v)).toBe("hot");
  });

  it("prefers closed over the irish tag — a closed Irish pub still reads as closed", () => {
    const v = makeVenueWithPulse({ subcategory: "IRISH", currentPulseStatus: "CLOSED" });
    expect(mapMarkerClass(v)).toBe("closed");
  });
});
