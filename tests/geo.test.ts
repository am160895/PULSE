import { describe, expect, it } from "vitest";
import { boundingBoxFromCenter, formatDistance, haversineDistanceMeters, isWithinBoundingBox, isWithinRadius } from "@/lib/geo";

describe("haversineDistanceMeters", () => {
  it("returns ~0 for identical points", () => {
    const p = { lat: 40.73, lng: -74.0 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 1);
  });

  it("matches a known approximate distance", () => {
    // West Village to SoHo center, roughly ~1.4km apart
    const a = { lat: 40.7357, lng: -74.0036 };
    const b = { lat: 40.7233, lng: -74.003 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(2000);
  });
});

describe("isWithinRadius", () => {
  it("is true within radius and false beyond it", () => {
    const venue = { lat: 40.7357, lng: -74.0036 };
    const near = { lat: 40.7358, lng: -74.0037 };
    const far = { lat: 40.8, lng: -73.9 };
    expect(isWithinRadius(near, venue, 200)).toBe(true);
    expect(isWithinRadius(far, venue, 200)).toBe(false);
  });
});

describe("bounding box", () => {
  it("contains the center and excludes far points", () => {
    const center = { lat: 40.73, lng: -74.0 };
    const box = boundingBoxFromCenter(center, 500);
    expect(isWithinBoundingBox(center, box)).toBe(true);
    expect(isWithinBoundingBox({ lat: 41.5, lng: -73.0 }, box)).toBe(false);
  });
});

describe("formatDistance", () => {
  it("uses friendly wording for very short distances", () => {
    expect(formatDistance(50)).toMatch(/steps/);
  });

  it("uses miles for longer distances", () => {
    expect(formatDistance(1609)).toMatch(/mi away/);
  });
});
