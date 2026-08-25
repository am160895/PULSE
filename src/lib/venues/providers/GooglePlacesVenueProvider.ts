import type { BusinessStatus } from "@/types";
import type {
  ExternalOpeningHours,
  ExternalVenue,
  ExternalVenueDetails,
  VenueDataProvider,
  VenueSearchOptions,
} from "./VenueDataProvider";

const API_BASE = "https://places.googleapis.com/v1";

// Field masks keep every request scoped to exactly what's needed — Places API (New)
// bills per field group, so requesting everything on every call would be needlessly
// expensive at any real volume (§4: "Control API costs carefully").
const SEARCH_FIELD_MASK = "places.id,places.displayName,places.location,places.formattedAddress,places.primaryType";
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "location",
  "formattedAddress",
  "primaryType",
  "businessStatus",
  "regularOpeningHours",
  "priceLevel",
  "rating",
  "userRatingCount",
  "websiteUri",
  "nationalPhoneNumber",
].join(",");

const BUSINESS_STATUS_MAP: Record<string, BusinessStatus> = {
  OPERATIONAL: "OPERATIONAL",
  CLOSED_TEMPORARILY: "CLOSED_TEMPORARILY",
  CLOSED_PERMANENTLY: "CLOSED_PERMANENTLY",
};

const PRICE_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlaceSearchResult {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  primaryType?: string;
}

interface GooglePlaceDetails extends GooglePlaceSearchResult {
  businessStatus?: string;
  regularOpeningHours?: {
    periods?: { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }[];
  };
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

function toExternalVenue(place: GooglePlaceSearchResult): ExternalVenue | null {
  if (!place.location || !place.displayName) return null;
  return {
    externalPlaceId: place.id,
    name: place.displayName.text,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    formattedAddress: place.formattedAddress ?? "",
    primaryType: place.primaryType ?? null,
  };
}

function toOpeningHours(details: GooglePlaceDetails): ExternalOpeningHours[] | null {
  const periods = details.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return null;

  return periods
    .filter((p) => p.close) // an always-open place reports a period with no close — not representable in our fixed-hours model, so it's skipped rather than guessed at
    .map((p) => ({
      dayOfWeek: p.open.day,
      openTime: `${String(p.open.hour).padStart(2, "0")}:${String(p.open.minute).padStart(2, "0")}`,
      closeTime: `${String(p.close!.hour).padStart(2, "0")}:${String(p.close!.minute).padStart(2, "0")}`,
    }));
}

/**
 * Uses the official Places API (New) — never scrapes Google Maps or depends on
 * unofficial endpoints (§4). Requires GOOGLE_PLACES_API_KEY; every call site in this app
 * is expected to check isConfigured() first and fall back to local/seed data otherwise,
 * exactly like the Supabase adapter pattern documented in IMPLEMENTATION_PLAN.md — this
 * has not been exercised against a real key in this environment, so treat it as
 * implemented-but-unverified until one is configured and it's tested end to end.
 */
export class GooglePlacesVenueProvider implements VenueDataProvider {
  readonly name = "google-places";

  constructor(private apiKey: string) {}

  static isConfigured(): boolean {
    return !!process.env.GOOGLE_PLACES_API_KEY;
  }

  static fromEnv(): GooglePlacesVenueProvider | null {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    return key ? new GooglePlacesVenueProvider(key) : null;
  }

  async searchPlaces(query: string, opts?: VenueSearchOptions): Promise<ExternalVenue[]> {
    const body: Record<string, unknown> = { textQuery: query };
    if (opts?.lat !== undefined && opts?.lng !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: opts.radiusMeters ?? 2000,
        },
      };
    }

    const res = await fetch(`${API_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Google Places search failed: ${res.status} ${await res.text().catch(() => "")}`);
    }

    const data = (await res.json()) as { places?: GooglePlaceSearchResult[] };
    return (data.places ?? []).map(toExternalVenue).filter((v): v is ExternalVenue => v !== null);
  }

  async getPlaceDetails(placeId: string): Promise<ExternalVenueDetails | null> {
    const res = await fetch(`${API_BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Google Places details failed: ${res.status} ${await res.text().catch(() => "")}`);
    }

    const details = (await res.json()) as GooglePlaceDetails;
    const base = toExternalVenue(details);
    if (!base) return null;

    return {
      ...base,
      businessStatus: details.businessStatus ? (BUSINESS_STATUS_MAP[details.businessStatus] ?? null) : null,
      regularOpeningHours: toOpeningHours(details),
      priceLevel: details.priceLevel ? (PRICE_LEVEL_MAP[details.priceLevel] ?? null) : null,
      rating: details.rating ?? null,
      userRatingCount: details.userRatingCount ?? null,
      websiteUri: details.websiteUri ?? null,
      nationalPhoneNumber: details.nationalPhoneNumber ?? null,
    };
  }
}
