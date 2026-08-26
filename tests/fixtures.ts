import type { UserNeighborhoodProgress, Venue, VenueHours, VenueReport, VenueSpecialHours, XpEvent } from "@/types";

export function makeHours(overrides: Partial<VenueHours> = {}): VenueHours {
  return {
    id: "h1",
    venueId: "venue-1",
    dayOfWeek: 0,
    isClosed: false,
    openTime: "00:00",
    closeTime: "23:59",
    source: "SEED",
    lastVerifiedAt: null,
    ...overrides,
  };
}

export function makeSpecialHours(overrides: Partial<VenueSpecialHours> = {}): VenueSpecialHours {
  return {
    id: "sh1",
    venueId: "venue-1",
    specialDate: "2026-01-02",
    isClosed: false,
    openTime: "20:00",
    closeTime: "04:00",
    reason: "New Year's Eve",
    source: "ADMIN",
    lastVerifiedAt: null,
    ...overrides,
  };
}

export function makeVenue(overrides: Partial<Venue> = {}): Venue {
  const id = overrides.id ?? "venue-1";
  const hours: VenueHours[] = overrides.hours ?? Array.from({ length: 7 }, (_, dayOfWeek) => makeHours({ id: `h${dayOfWeek + 1}`, venueId: id, dayOfWeek }));

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

export function makeXpEvent(overrides: Partial<XpEvent> = {}): XpEvent {
  return {
    id: overrides.id ?? "xp-1",
    userId: "user-1",
    rewardType: "CROWD_REPORT",
    xpAmount: 15,
    sourceId: "report-1",
    venueId: "venue-1",
    neighborhood: "West Village",
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeNeighborhoodProgress(overrides: Partial<UserNeighborhoodProgress> = {}): UserNeighborhoodProgress {
  return {
    userId: "user-1",
    neighborhood: "West Village",
    xp: 0,
    updatedAt: new Date().toISOString(),
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
