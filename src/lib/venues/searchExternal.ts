import type { Venue } from "@/types";
import { GooglePlacesVenueProvider } from "./providers/GooglePlacesVenueProvider";
import { mapGoogleTypeToVenueType } from "./mapGoogleType";
import { getVenueByExternalPlaceId, upsertDirectoryVenueFromExternal } from "@/lib/data/repository";
import { DEMO_TIMEZONE } from "@/config/constants";

/**
 * Supplements local search results with real Google-sourced venues we haven't seen
 * before, so search covers real nightlife inventory beyond the seed set (§9: "show all
 * real venues"). Deliberately search-only, not detail-enriched: fetching full
 * getPlaceDetails (hours/rating/business status) for every search hit would multiply API
 * cost for venues nobody ends up viewing — new venues surface as DIRECTORY coverage with
 * unknown hours until enrichment on view is built (see README's known-limitations list).
 * No-ops safely (returns []) whenever GOOGLE_PLACES_API_KEY isn't configured — this path
 * has not been exercised against a real key in this environment.
 */
export async function searchExternalDirectoryVenues(query: string): Promise<Venue[]> {
  const provider = GooglePlacesVenueProvider.fromEnv();
  if (!provider) return [];

  try {
    const results = await provider.searchPlaces(query);
    const unseen = [];
    for (const r of results) {
      if (!(await getVenueByExternalPlaceId(r.externalPlaceId))) unseen.push(r);
    }
    return await Promise.all(
      unseen.map((r) =>
        upsertDirectoryVenueFromExternal({
          externalPlaceId: r.externalPlaceId,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          streetAddress: r.formattedAddress,
          city: "New York",
          state: "NY",
          postalCode: "",
          timezone: DEMO_TIMEZONE,
          venueType: mapGoogleTypeToVenueType(r.primaryType),
          hours: [],
          businessStatus: null,
          priceLevel: null,
          externalRating: null,
          externalRatingCount: null,
          website: null,
        })
      )
    );
  } catch (err) {
    // Google outage/quota/misconfiguration must not break local search — log and degrade
    // to local-only results rather than surfacing an error for an enhancement layer.
    console.error("Google Places search failed, continuing with local results only:", err);
    return [];
  }
}
