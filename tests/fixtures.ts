import type { Venue, VenueHours, VenueReport } from "@/types";

export function makeVenue(overrides: Partial<Venue> = {}): Venue {
  const id = overrides.id ?? "venue-1";
  const hours: VenueHours[] = overrides.hours ?? [
    { id: "h1", venueId: id, dayOfWeek: 0, openTime: "00:00", closeTime: "23:59" },
    { id: "h2", venueId: id, dayOfWeek: 1, openTime: "00:00", closeTime: "23:59" },
    { id: "h3", venueId: id, dayOfWeek: 2, openTime: "00:00", closeTime: "23:59" },
    { id: "h4", venueId: id, dayOfWeek: 3, openTime: "00:00", closeTime: "23:59" },
    { id: "h5", venueId: id, dayOfWeek: 4, openTime: "00:00", closeTime: "23:59" },
    { id: "h6", venueId: id, dayOfWeek: 5, openTime: "00:00", closeTime: "23:59" },
    { id: "h7", venueId: id, dayOfWeek: 6, openTime: "00:00", closeTime: "23:59" },
  ];

  return {
    id,
    externalPlaceId: null,
    name: "Test Venue",
    slug: "test-venue",
    category: "Nightlife",
    subcategory: null,
    venueType: "CLUB",
    neighborhood: "Test Neighborhood",
    streetAddress: "1 Test St",
    city: "New York",
    state: "NY",
    postalCode: "10014",
    latitude: 40.7357,
    longitude: -74.0036,
    timezone: "America/New_York",
    website: null,
    instagramHandle: null,
    capacityEstimate: 300,
    priceLevel: 2,
    musicType: "House",
    isActive: true,
    hours,
    businessStatus: null,
    externalRating: null,
    externalRatingCount: null,
    claimStatus: "UNCLAIMED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeReport(overrides: Partial<VenueReport> = {}): VenueReport {
  return {
    id: overrides.id ?? "report-1",
    venueId: "venue-1",
    userId: "user-1",
    createdAt: new Date().toISOString(),
    crowdLevel: "BUSY",
    waitLevel: "SHORT",
    energyLevel: "GOOD",
    crowdNote: null,
    reportSource: "APP",
    isVerifiedNearby: true,
    trustWeightAtSubmission: 0.5,
    ...overrides,
  };
}

/** A Friday at 23:30 in America/New_York (relative to a fixed reference so tests are deterministic). */
export function fridayNightNow(): Date {
  // 2026-01-02 is a Friday.
  return new Date("2026-01-02T23:30:00-05:00");
}

export function tuesdayAfternoonNow(): Date {
  // 2025-12-30 is a Tuesday.
  return new Date("2025-12-30T15:00:00-05:00");
}
