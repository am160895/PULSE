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

export type HoursSource = "SEED" | "ADMIN" | "VENUE_OWNER" | "GOOGLE_PLACES";

export interface VenueHours {
  id: string;
  venueId: string;
  dayOfWeek: number; // 0 = Sunday
  isClosed: boolean;
  openTime: string | null; // "HH:mm"; null iff isClosed
  closeTime: string | null; // "HH:mm", may be < openTime (crosses midnight); null iff isClosed
  source: HoursSource;
  lastVerifiedAt: string | null;
}

/** A one-date override that wins entirely over that date's regular VenueHours row(s) —
 * holiday closures, private events, late openings. `specialDate` is venue-LOCAL. */
export interface VenueSpecialHours {
  id: string;
  venueId: string;
  specialDate: string; // "YYYY-MM-DD", venue-local
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  reason: string | null;
  source: HoursSource;
  lastVerifiedAt: string | null;
}

/** The full "is this venue open" answer for UI display — see lib/venues/getVenueOpenStatus.ts. */
export interface VenueOpenStatus {
  isOpen: boolean;
  status: VenueOpenState;
  closesAt: string | null; // ISO instant; set iff isOpen
  opensAt: string | null; // ISO instant; set iff isOpen
  nextOpenAt: string | null; // ISO instant of the next future opening; null iff isOpen/UNKNOWN/PERMANENTLY_CLOSED
  hoursConfidence: ConfidenceLabel;
  displayText: string;
}

/** LIVE = currently open, showing a real-time score. CLOSED = don't show a live-looking
 * score at all, regardless of what the raw pulseScore number happens to compute to. */
export type CurrentPulseStatus = "LIVE" | "CLOSED";

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

// ---- gamification (PULSE XP) ----
// XP is deliberately kept separate from trust (above): XP is a visible progression
// mechanic, trust is an internal data-quality multiplier never shown to users. See
// src/lib/gamification/.

export type XpRewardType =
  | "I_AM_HERE"
  | "CROWD_REPORT"
  | "WAIT_REPORT"
  | "ENERGY_REPORT"
  | "LIVE_NOTE"
  | "FIRST_REPORT_TONIGHT"
  | "SIGNAL_CONFIRMED"
  | "VENUE_CORRECTION";

export type BadgeCode =
  | "FIRST_SIGNAL"
  | "TREND_SPOTTER"
  | "LINE_SAVER"
  | "NIGHT_OWL"
  | "ON_THE_PULSE"
  | "CITY_SCOUT"
  | "EARLY_SIGNAL"
  | "NEIGHBORHOOD_INSIDER";

export interface XpEvent {
  id: string;
  userId: string;
  rewardType: XpRewardType;
  xpAmount: number;
  sourceId: string;
  venueId: string | null;
  neighborhood: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UserProgress {
  userId: string;
  totalXp: number;
  updatedAt: string;
}

export interface UserNeighborhoodProgress {
  userId: string;
  neighborhood: string;
  xp: number;
  updatedAt: string;
}

export interface BadgeDefinition {
  code: BadgeCode;
  name: string;
  description: string;
  motif: string;
  sortOrder: number;
}

export interface UserBadge {
  userId: string;
  badgeCode: BadgeCode;
  neighborhood: string; // "" for non-neighborhood-scoped badges
  awardedAt: string;
  xpEventId: string | null;
}

/** A delayed-accuracy confirmation newly awarded THIS request — see
 * lib/gamification/consensus.ts. Surfaced by /api/venues and /api/venues/[id] so the
 * client can fire an "ACCURATE SIGNAL" toast without a dedicated polling endpoint. */
export interface ConfirmedSignal {
  reportId: string;
  venueId: string;
  xpAwarded: number;
}

export type ContributorLevelName = "EXPLORER" | "SCOUT" | "INSIDER" | "LOCAL" | "PULSE_PRO";

export interface ContributorLevel {
  name: ContributorLevelName;
  label: string;
  minXp: number;
  /** null for the top level — there's nothing to progress toward. */
  nextLevelXp: number | null;
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
  /** Richer than openState alone — closesAt/opensAt/nextOpenAt/confidence for display. */
  openStatus: VenueOpenStatus;
  /** Thin derivation of openState — see lib/venues/currentPulseStatus.ts. UI must branch on
   * this (not pulseScore) before deciding whether to show a live-looking score at all. */
  currentPulseStatus: CurrentPulseStatus;
  /** True when a verified-nearby report arrived recently at a venue that's currently
   * CLOSED per its hours — flags for review, never auto-reopens the venue. */
  hoursDiscrepancy: boolean;
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
