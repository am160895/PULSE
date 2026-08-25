import type { VenueType } from "@/types";

export const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const MAP_DEFAULT_CENTER = { lng: -73.9967, lat: 40.7275 }; // West Village-ish center of launch area
export const MAP_DEFAULT_ZOOM = 13.2;

// ---- Pulse Score engine tuning ----

// Two weight regimes, interpolated by how much live-report confidence exists
// (see signals/confidence.ts's reportConfidenceFactor). This is what makes "sparse
// reports -> baseline matters more" AND "strong reports -> baseline matters less"
// both true — a single fixed weight table can only satisfy one direction.
// timeOpenness isn't in either table: it's applied as a multiplicative gate on the
// final blend (see signals/timeDecay.ts), not averaged in as a component.
export const SCORE_WEIGHTS_LOW_DATA = {
  liveReports: 0.05,
  trend: 0.05,
  historical: 0.65,
  event: 0.15,
  friendActivity: 0.1,
} as const;

export const SCORE_WEIGHTS_HIGH_DATA = {
  liveReports: 0.45,
  trend: 0.25,
  historical: 0.1,
  event: 0.15,
  friendActivity: 0.05,
} as const;

export const REPORT_DECAY_HALF_LIFE_MINUTES = 25;
export const REPORT_IRRELEVANT_AFTER_MINUTES = 180;
export const REPORT_COOLDOWN_MINUTES = 25;
export const REPORT_PROXIMITY_RADIUS_METERS = 200;

export const SCORE_SMOOTHING_BASE_RETENTION = 0.65; // previousScore weight when confidence is low
export const SCORE_SMOOTHING_MIN_RETENTION = 0.3; // previousScore weight when confidence is high (score can move faster)

export const TREND_WINDOW_MINUTES = 30;
export const TREND_THRESHOLDS = {
  risingFast: 10,
  rising: 4,
  fallingFast: -10,
  falling: -4,
} as const;

export const FRESHNESS_BANDS_MINUTES = {
  live: 5,
  recent: 15,
  estimated: 45,
} as const;

export const PULSE_LABEL_BANDS = [
  { min: 90, label: "HOT_NOW" as const },
  { min: 80, label: "VERY_ACTIVE" as const },
  { min: 65, label: "BUSY" as const },
  { min: 45, label: "MODERATE" as const },
  { min: 25, label: "QUIET" as const },
  { min: 0, label: "VERY_QUIET" as const },
];

export const CONFIDENCE_LABEL_BANDS = [
  { min: 70, label: "HIGH" as const },
  { min: 40, label: "MEDIUM" as const },
  { min: 0, label: "LOW" as const },
];

export const WAIT_LEVEL_RANGES: Record<string, { min: number; max: number | null }> = {
  NONE: { min: 0, max: 5 },
  SHORT: { min: 5, max: 15 },
  MEDIUM: { min: 15, max: 30 },
  LONG: { min: 30, max: 60 },
  VERY_LONG: { min: 60, max: null },
};

export const TRUST_SCORE_DEFAULT = 0.5;
export const TRUST_SCORE_MIN = 0.15;
export const TRUST_SCORE_MAX = 1.0;
export const NEW_ACCOUNT_TRUST_PENALTY_DAYS = 3;

export const PRESENCE_DEFAULT_TIMEOUT_MINUTES = 120;
export const PRESENCE_MAX_TIMEOUT_MINUTES = 360;

// ---- live-data refresh cadence ----
export const MAP_REFRESH_MS = 45_000;
export const VENUE_DETAIL_REFRESH_MS = 20_000;

// ---- launch geography ----

export interface Neighborhood {
  slug: string;
  name: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  { slug: "west-village", name: "West Village", center: { lat: 40.7357, lng: -74.0036 }, radiusMeters: 700 },
  { slug: "greenwich-village", name: "Greenwich Village", center: { lat: 40.7336, lng: -73.9975 }, radiusMeters: 650 },
  { slug: "soho", name: "SoHo", center: { lat: 40.7233, lng: -74.003 }, radiusMeters: 650 },
  { slug: "les", name: "Lower East Side", center: { lat: 40.7181, lng: -73.9857 }, radiusMeters: 700 },
  { slug: "east-village", name: "East Village", center: { lat: 40.7265, lng: -73.9815 }, radiusMeters: 700 },
  { slug: "chelsea", name: "Chelsea", center: { lat: 40.7465, lng: -74.0014 }, radiusMeters: 800 },
  { slug: "meatpacking", name: "Meatpacking District", center: { lat: 40.7402, lng: -74.0079 }, radiusMeters: 450 },
  { slug: "nolita", name: "Nolita", center: { lat: 40.7233, lng: -73.9957 }, radiusMeters: 400 },
  { slug: "noho", name: "NoHo", center: { lat: 40.7285, lng: -73.9925 }, radiusMeters: 400 },
];

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  BAR: "Bar",
  CLUB: "Club",
  LOUNGE: "Lounge",
  ROOFTOP: "Rooftop",
  RESTAURANT: "Restaurant",
  LIVE_MUSIC: "Live Music",
  CAFE: "Cafe",
  EVENT_SPACE: "Event Space",
  OTHER: "Other",
};

export const DEMO_CITY = "New York City";
export const DEMO_TIMEZONE = "America/New_York";
