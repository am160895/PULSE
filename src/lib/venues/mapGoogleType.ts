import type { VenueType } from "@/types";

// Google's `primaryType` taxonomy (https://developers.google.com/maps/documentation/places/web-service/place-types)
// doesn't have a nightlife-specific vocabulary as granular as ours — this is a best-effort
// mapping, not a guarantee; anything unrecognized falls back to OTHER rather than guessing.
const TYPE_MAP: Record<string, VenueType> = {
  night_club: "CLUB",
  bar: "BAR",
  pub: "BAR",
  wine_bar: "LOUNGE",
  restaurant: "RESTAURANT",
  bar_and_grill: "RESTAURANT",
  live_music_venue: "LIVE_MUSIC",
  cafe: "CAFE",
  coffee_shop: "CAFE",
  event_venue: "EVENT_SPACE",
  banquet_hall: "EVENT_SPACE",
};

export function mapGoogleTypeToVenueType(primaryType: string | null): VenueType {
  if (!primaryType) return "OTHER";
  return TYPE_MAP[primaryType] ?? "OTHER";
}
