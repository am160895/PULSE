import { describe, expect, it } from "vitest";
import { applyImportDefaults, parseCsvImport, parsePasteImport } from "@/lib/venues/importParser";

describe("parsePasteImport", () => {
  it("parses well-formed lines", () => {
    const { rows, issues } = parsePasteImport("The Wren | 369 Rivington St, New York, NY | bar | Lower East Side");
    expect(issues).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: 1,
      name: "The Wren",
      address: "369 Rivington St, New York, NY",
      venueType: "BAR",
      neighborhood: "Lower East Side",
    });
  });

  it("skips blank lines silently", () => {
    const { rows } = parsePasteImport("\n\nThe Wren | 123 St | BAR | LES\n\n");
    expect(rows).toHaveLength(1);
  });

  it("reports a row with too few fields as an issue, not a crash", () => {
    const { rows, issues } = parsePasteImport("Just a name | 123 St");
    expect(rows).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0].row).toBe(1);
  });

  it("reports a row with an empty required field as an issue", () => {
    const { rows, issues } = parsePasteImport("Name |  | BAR | LES");
    expect(rows).toHaveLength(0);
    expect(issues).toHaveLength(1);
  });

  it("numbers rows by line, independent of earlier issues", () => {
    const { rows, issues } = parsePasteImport("bad line\nGood Bar | 1 St | BAR | LES");
    expect(issues[0].row).toBe(1);
    expect(rows[0].row).toBe(2);
  });
});

describe("parseCsvImport", () => {
  it("parses a header + data row, matching columns by name regardless of order", () => {
    const csv = "neighborhood,name,address\nWest Village,Le Dive,1 St";
    const { rows, issues } = parseCsvImport(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0]).toMatchObject({ name: "Le Dive", address: "1 St", neighborhood: "West Village" });
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = 'name,address\n"Bar, Inc.","123 Main St, Suite 2"';
    const { rows } = parseCsvImport(csv);
    expect(rows[0].name).toBe("Bar, Inc.");
    expect(rows[0].address).toBe("123 Main St, Suite 2");
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const csv = 'name,address\n"The ""Best"" Bar",1 St';
    const { rows } = parseCsvImport(csv);
    expect(rows[0].name).toBe('The "Best" Bar');
  });

  it("errors clearly when required columns are missing", () => {
    const { rows, issues } = parseCsvImport("foo,bar\n1,2");
    expect(rows).toHaveLength(0);
    expect(issues).toHaveLength(1);
  });

  it("flags a row missing name/address without dropping other valid rows silently", () => {
    const csv = "name,address\n,123 St\nGood Bar,1 St";
    const { rows, issues } = parseCsvImport(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Good Bar");
    expect(issues).toHaveLength(1);
  });

  it("parses per-day hours columns, treating a blank pair as closed", () => {
    const csv = "name,address,mon_open,mon_close,tue_open,tue_close\nBar,1 St,18:00,02:00,,";
    const { rows } = parseCsvImport(csv);
    expect(rows[0].hours).toEqual([{ dayOfWeek: 1, openTime: "18:00", closeTime: "02:00" }]);
  });

  it("clamps an out-of-range priceLevel to null rather than passing it through", () => {
    const csv = "name,address,priceLevel\nBar,1 St,9";
    const { rows } = parseCsvImport(csv);
    expect(rows[0].priceLevel).toBeNull();
  });
});

describe("applyImportDefaults", () => {
  it("fills in the same NYC-only defaults VenueForm.tsx applies for manual entry", () => {
    const { rows } = parsePasteImport("Le Dive | 1 St | BAR | West Village");
    const built = applyImportDefaults(rows[0], { lat: 40.7, lng: -74.0 });
    expect(built).toMatchObject({
      category: "Nightlife",
      city: "New York",
      state: "NY",
      timezone: "America/New_York",
      priceLevel: 2,
      isActive: true,
      latitude: 40.7,
      longitude: -74.0,
    });
  });

  it("never fabricates a priceLevel when one was actually supplied", () => {
    const csv = "name,address,priceLevel\nBar,1 St,4";
    const { rows } = parseCsvImport(csv);
    const built = applyImportDefaults(rows[0], { lat: 0, lng: 0 });
    expect(built.priceLevel).toBe(4);
  });

  it("derives city/state/postal from the address instead of hardcoding New York, NY — e.g. for NJ venues", () => {
    const { rows } = parsePasteImport("Zeppelin Hall | 88 Liberty View Dr, Jersey City, NJ 07305 | BAR | Downtown Jersey City");
    const built = applyImportDefaults(rows[0], { lat: 40.7, lng: -74.0 });
    expect(built.city).toBe("Jersey City");
    expect(built.state).toBe("NJ");
    expect(built.postalCode).toBe("07305");
  });
});
