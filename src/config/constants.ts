import type { ContributorLevelName, VenueType, XpRewardType } from "@/types";

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

// ---- opening hours ----

export const HOURS_VERIFIED_FRESH_DAYS = 60;
export const HOURS_VERIFIED_STALE_DAYS = 120;
export const HOURS_DISCREPANCY_WINDOW_MINUTES = 30;

// ---- gamification: PULSE XP ----
// Reward values are server-decided (never trusted from the client) — see
// src/lib/gamification/xp.ts, the only place these are read.
export const XP_VALUES: Record<XpRewardType, number> = {
  I_AM_HERE: 10,
  CROWD_REPORT: 15,
  WAIT_REPORT: 10,
  ENERGY_REPORT: 8,
  LIVE_NOTE: 8,
  FIRST_REPORT_TONIGHT: 20,
  SIGNAL_CONFIRMED: 10,
  VENUE_CORRECTION: 20,
} as const;

export const FIRST_REPORT_TONIGHT_WINDOW_HOURS = 6;

export const CONTRIBUTOR_LEVELS: Array<{ name: ContributorLevelName; label: string; minXp: number }> = [
  { name: "EXPLORER", label: "Explorer", minXp: 0 },
  { name: "SCOUT", label: "Scout", minXp: 100 },
  { name: "INSIDER", label: "Insider", minXp: 350 },
  { name: "LOCAL", label: "Local", minXp: 1000 },
  { name: "PULSE_PRO", label: "Pulse Pro", minXp: 2500 },
];

export const NEIGHBORHOOD_INSIDER_XP_THRESHOLD = 150;
export const CITY_SCOUT_MIN_NEIGHBORHOODS = 3;
export const ON_THE_PULSE_DISTINCT_DAYS = 3;
export const NIGHT_OWL_MIN_COUNT = 5;
export const LINE_SAVER_MIN_COUNT = 3;
export const TREND_SPOTTER_MIN_CONFIRMED = 3;

// Delayed accuracy confirmation (§5/§33 of the gamification spec) — a report is
// eligible for a "your signal was confirmed" bonus once it's aged into this window and
// enough later reports at the same venue landed close to its value. See
// src/lib/gamification/consensus.ts.
export const SIGNAL_CONFIRMATION_MIN_AGE_MINUTES = 20;
export const SIGNAL_CONFIRMATION_MAX_AGE_MINUTES = 45;
export const SIGNAL_CONFIRMATION_MIN_CORROBORATING_REPORTS = 3;
export const SIGNAL_CONFIRMATION_MAX_VALUE_DELTA = 20;

// Pulse impact messaging (§32) — thresholds for "you moved the score" vs "confidence increased".
export const IMPACT_SCORE_DELTA_THRESHOLD = 3;
export const IMPACT_CONFIDENCE_DELTA_THRESHOLD = 5;

// ---- historical memory: nightlife-day time model + rollups ----

/** Local hour a "night out" starts belonging to the NEXT calendar day — nightlife runs
 * later than the calendar day does, so 2 AM Saturday is still Friday night. */
export const NIGHTLIFE_DAY_BOUNDARY_HOUR = 6;
export const ROLLUP_LOOKBACK_NIGHTS = 8;
export const VS_TYPICAL_MIN_SAMPLE_NIGHTS = 3;
export const VS_TYPICAL_THRESHOLDS = { muchBusier: 30, busier: 12, quieter: -12, muchQuieter: -30 } as const;

// ---- ranking polish: Best Bet ----
export const BEST_BET_MIN_SCORE = 60;
export const BEST_BET_MAX_DISTANCE_METERS = 3000;
export const BEST_BET_MIN_MINUTES_UNTIL_CLOSE = 60;

// ---- admin bulk venue import ----
// Sequential processing to respect Nominatim's 1 req/sec geocoding policy — this cap keeps
// a single import request comfortably bounded even though there's no chunking/streaming.
export const IMPORT_MAX_ROWS = 40;
