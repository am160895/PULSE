import type { BadgeCode } from "@/types";

// Mirrors the seed data in supabase/migrations/0002_gamification_and_hours.sql — keep the
// two in sync when either changes, same convention as this app's DB-mirroring types.
export interface BadgeCatalogEntry {
  code: BadgeCode;
  name: string;
  description: string;
  motif: string;
}

export const BADGE_CATALOG: Record<BadgeCode, BadgeCatalogEntry> = {
  FIRST_SIGNAL: {
    code: "FIRST_SIGNAL",
    name: "First Signal",
    description: "First verified useful report from a venue that evening.",
    motif: "radiating-dot",
  },
  TREND_SPOTTER: {
    code: "TREND_SPOTTER",
    name: "Trend Spotter",
    description: "Called it early — your report was confirmed by the crowd that followed.",
    motif: "rising-line",
  },
  LINE_SAVER: {
    code: "LINE_SAVER",
    name: "Line Saver",
    description: "Submitted multiple accurate wait-time reports.",
    motif: "minimal-clock",
  },
  NIGHT_OWL: {
    code: "NIGHT_OWL",
    name: "Night Owl",
    description: "Useful verified contribution after midnight.",
    motif: "abstract-moon",
  },
  ON_THE_PULSE: {
    code: "ON_THE_PULSE",
    name: "On the Pulse",
    description: "Contributed on multiple nights out.",
    motif: "concentric-pulse",
  },
  CITY_SCOUT: {
    code: "CITY_SCOUT",
    name: "City Scout",
    description: "Useful contributions across multiple neighborhoods.",
    motif: "location-signal",
  },
  EARLY_SIGNAL: {
    code: "EARLY_SIGNAL",
    name: "Early Signal",
    description: "Reported meaningful activity before the crowd confirmed it.",
    motif: "radiating-dot",
  },
  NEIGHBORHOOD_INSIDER: {
    code: "NEIGHBORHOOD_INSIDER",
    name: "Neighborhood Insider",
    description: "Earned a neighborhood's contribution threshold.",
    motif: "location-signal",
  },
  FOUNDING_SCOUT: {
    code: "FOUNDING_SCOUT",
    name: "Founding Scout",
    description: "One of the first 100 people to make a real contribution to PULSE.",
    motif: "founding-seal",
  },
};

/** NEIGHBORHOOD_INSIDER is scoped per-neighborhood (spec §7's "West Village Scout" —
 * display composes the actual earned name from data, not a manually-picked badge). */
export function neighborhoodBadgeDisplayName(neighborhood: string): string {
  return `${neighborhood} Insider`;
}
