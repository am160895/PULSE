import type { BusinessStatus } from "@/types";

/**
 * The factual, third-party business layer — name/address/hours/rating, never PULSE's own
 * activity data. Google is one implementation; searchPlaces/getPlaceDetails deliberately
 * don't leak Google-specific shapes so a second provider (or a future licensed data
 * source) can drop in without touching call sites.
 */
export interface ExternalVenue {
  externalPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  primaryType: string | null;
}

export interface ExternalOpeningHours {
  dayOfWeek: number; // 0 = Sunday
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

export interface ExternalVenueDetails extends ExternalVenue {
  businessStatus: BusinessStatus | null;
  regularOpeningHours: ExternalOpeningHours[] | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  nationalPhoneNumber: string | null;
}

export interface VenueSearchOptions {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}

export interface VenueDataProvider {
  readonly name: string;
  searchPlaces(query: string, opts?: VenueSearchOptions): Promise<ExternalVenue[]>;
  getPlaceDetails(placeId: string): Promise<ExternalVenueDetails | null>;
}
