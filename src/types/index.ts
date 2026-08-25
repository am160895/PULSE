// Shared domain types. These mirror the production Postgres schema in
// supabase/migrations/0001_init.sql — keep the two in sync when either changes.

export type VenueType =
  | "BAR"
  | "CLUB"
  | "LOUNGE"
  | "ROOFTOP"
  | "RESTAURANT"
  | "LIVE_MUSIC"
  | "CAFE"
  | "EVENT_SPACE"
  | "OTHER";

export type CrowdLevel = "EMPTY" | "QUIET" | "MODERATE" | "BUSY" | "PACKED";
export type WaitLevel = "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
export type EnergyLevel = "LOW" | "CHILL" | "GOOD" | "HIGH" | "VERY_HIGH";
export type TrendDirection = "RISING_FAST" | "RISING" | "STABLE" | "FALLING" | "FALLING_FAST";
export type FriendshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";
export type Visibility = "PRIVATE" | "FRIENDS" | "CLOSE_FRIENDS";
export type PresenceStatus = "AT_VENUE" | "HEADING_THERE" | "NEARBY" | "RECENTLY_HERE";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";
export type PulseLabel =
  | "HOT_NOW"
  | "VERY_ACTIVE"
  | "BUSY"
  | "MODERATE"
  | "QUIET"
  | "VERY_QUIET";
export type FreshnessLabel = "LIVE" | "RECENT" | "ESTIMATED" | "TYPICAL";

/** Derived, never stored — see src/lib/venues/openState.ts, the one function that computes this. */
export type VenueOpenState =
  | "OPEN"
  | "CLOSING_SOON"
  | "CLOSED"
  | "TEMPORARILY_CLOSED"
  | "PERMANENTLY_CLOSED"
  | "UNKNOWN";

/**
 * How much to trust what's shown for this venue, independent of the score/confidence
 * numbers themselves: LIVE/RECENT/TYPICAL come from PULSE's own signals (see
 * pulse/signals/confidence.ts's freshness bands); DIRECTORY means a real, known venue
 * (from Google Places or the seed set) with no meaningful PULSE activity data at all —
 * never fabricate a live score for one of these.
 */
export type VenueCoverageState = "LIVE" | "RECENT" | "TYPICAL" | "DIRECTORY";

/** Google Business Status, when sourced from Google Places — see lib/venues/providers. */
export type BusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

/** Scaffolding for the future PULSE for Venues product — not yet backed by a claim flow UI. */
export type VenueClaimStatus = "UNCLAIMED" | "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

/** Scaffolding for future owner-facing diagnostics — not yet computed anywhere. */
export type VenueProblemType =
  | "NONE"
  | "MARKET_SOFTNESS"
  | "LOW_AWARENESS"
  | "LOW_CONVERSION"
  | "QUEUE_FRICTION"
  | "DOOR_FRICTION"
  | "CAPACITY_PRESSURE"
  | "COMPETITOR_EVENT"
  | "POOR_TIMING"
  | "UNKNOWN";

/** A user's stated intent for the night — used only to bias deterministic sort/ranking, never a fake personalization claim. */
export type NightIntent = "PARTY" | "DATE" | "DRINKS" | "CHILL";
export type ReportSource = "APP" | "SIMULATOR";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export type UserRole = "USER" | "ADMIN";

export interface Profile {
  id: string;
  authUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  homeCity: string;
  interests: VenueType[];
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface VenueHours {
  id: string;
  venueId: string;
  dayOfWeek: number; // 0 = Sunday
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm", may be < openTime (crosses midnight)
}

export interface Venue {
  id: string;
  externalPlaceId: string | null;
  name: string;
  slug: string;
  category: string;
  subcategory: string | null;
  venueType: VenueType;
  neighborhood: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  website: string | null;
  instagramHandle: string | null;
  capacityEstimate: number | null;
  priceLevel: 1 | 2 | 3 | 4;
  musicType: string | null;
  isActive: boolean;
  hours: VenueHours[];
  /** Set only when externalPlaceId came from Google Places; absent for seed-only venues. */
  businessStatus: BusinessStatus | null;
  /** Google's rating/count are factual third-party context, kept deliberately separate
   * from anything PULSE computes — never blended into pulseScore. */
  externalRating: number | null;
  externalRatingCount: number | null;
  claimStatus: VenueClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VenueEvent {
  id: string;
  venueId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  eventType: string;
  source: string;
  externalUrl: string | null;
  createdAt: string;
}

export interface VenueReport {
  id: string;
  venueId: string;
  userId: string;
  createdAt: string;
  crowdLevel: CrowdLevel;
  waitLevel: WaitLevel;
  energyLevel: EnergyLevel;
  crowdNote: string | null;
  reportSource: ReportSource;
  isVerifiedNearby: boolean;
  trustWeightAtSubmission: number;
}

export interface WaitEstimate {
  minMinutes: number;
  maxMinutes: number | null; // null = "30+"
}

export interface VenueSignalSnapshot {
  id: string;
  venueId: string;
  capturedAt: string;
  pulseScore: number;
  confidenceScore: number;
  crowdScore: number;
  trendScore: number;
  reportScore: number;
  historicalScore: number;
  eventScore: number;
  friendActivityScore: number;
  trendDirection: TrendDirection;
  waitEstimate: WaitEstimate | null;
  expectedPeak: { start: string; end: string } | null;
  signalVersion: number;
}

export interface VenueHourlyBaseline {
  id: string;
  venueId: string;
  dayOfWeek: number;
  hourOfDay: number;
  expectedActivityScore: number;
  expectedWaitScore: number;
  sampleCount: number;
  updatedAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PresencePreferences {
  userId: string;
  defaultVisibility: Visibility;
  allowVenuePresence: boolean;
  allowNearbyPresence: boolean;
  allowRecentPresence: boolean;
  presenceTimeoutMinutes: number;
  updatedAt: string;
}

export interface PresenceEvent {
  id: string;
  userId: string;
  venueId: string;
  status: PresenceStatus;
  visibility: Visibility;
  startedAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface SavedVenue {
  userId: string;
  venueId: string;
  createdAt: string;
}

export interface ReportFlag {
  id: string;
  reportId: string;
  flaggedBy: string;
  reason: string;
  createdAt: string;
}

export interface UserTrustScore {
  userId: string;
  trustScore: number; // 0–1 multiplier, not shown to users
  reportsSubmitted: number;
  reportsConfirmed: number;
  reportsFlagged: number;
  updatedAt: string;
}

// ---- computed / API-facing shapes (not persisted as-is) ----

export interface PulseReasonComponent {
  key: string;
  label: string;
  value: number; // signed contribution to the 0-100 score
}

export interface PulseResult {
  pulseScore: number;
  pulseLabel: PulseLabel;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  freshness: FreshnessLabel;
  trend: TrendDirection;
  trendDeltaLast30Min: number;
  expectedPeak: { start: string; end: string } | null;
  waitEstimate: WaitEstimate | null;
  components: PulseReasonComponent[];
  explanation: string;
}

export interface VenueWithPulse extends Venue {
  pulse: PulseResult;
  /** Independent of pulse — see lib/venues/openState.ts. A closed venue can't be "hot." */
  openState: VenueOpenState;
  /** LIVE/RECENT/TYPICAL come from pulse.freshness; DIRECTORY means no PULSE data exists
   * at all for this venue and the UI must not show a fabricated score — see lib/venues/coverageState.ts. */
  coverageState: VenueCoverageState;
  distanceMeters?: number;
  friendsPresent?: PresenceSummary[];
  isSaved?: boolean;
}

export interface PresenceSummary {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
  venueId: string | null;
  venueName: string | null;
  startedAt: string;
}
