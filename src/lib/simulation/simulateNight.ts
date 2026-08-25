import type { CrowdLevel, EnergyLevel, ReportSource, Venue, WaitLevel } from "@/types";
import { mulberry32 } from "@/lib/geo";
import { zonedParts } from "@/lib/time/zoned";
import { expectedActivityScore, expectedWaitScore } from "./activityCurve";

export interface SimulatedReport {
  userId: string;
  createdAt: string;
  crowdLevel: CrowdLevel;
  waitLevel: WaitLevel;
  energyLevel: EnergyLevel;
  crowdNote: string | null;
  isVerifiedNearby: boolean;
  reportSource: ReportSource;
  trustWeightAtSubmission: number;
}

export interface SimulateNightOptions {
  venue: Venue;
  now: Date;
  reporterProfileIds: string[];
  maxReports?: number;
  /** Fraction of eligible reports that actually get "submitted" — deliberately generous for a demo, real launches will be far sparser. */
  adoptionRate?: number;
}

function hashToInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function activityToCrowdLevel(value: number): CrowdLevel {
  if (value < 15) return "EMPTY";
  if (value < 35) return "QUIET";
  if (value < 55) return "MODERATE";
  if (value < 78) return "BUSY";
  return "PACKED";
}

function waitScoreToLevel(value: number): WaitLevel {
  if (value < 10) return "NONE";
  if (value < 30) return "SHORT";
  if (value < 55) return "MEDIUM";
  if (value < 80) return "LONG";
  return "VERY_LONG";
}

const ENERGY_POOL: EnergyLevel[] = ["CHILL", "GOOD", "GOOD", "HIGH", "HIGH", "VERY_HIGH"];

const NOTES = [
  "Line moving fast",
  "Good energy",
  "Dance floor opened up",
  "DJ just started",
  null,
  null,
  null,
];

export function simulateReportsForVenue(options: SimulateNightOptions): SimulatedReport[] {
  const { venue, now, reporterProfileIds, maxReports = 3, adoptionRate = 0.35 } = options;
  if (reporterProfileIds.length === 0) return [];

  const venueSeed = hashToInt(venue.id);
  const zoned = zonedParts(now, venue.timezone);
  const targetActivity = expectedActivityScore(venue.venueType, venueSeed, zoned.dayOfWeek, zoned.hour);
  const targetWait = expectedWaitScore(targetActivity);

  const rand = mulberry32(venueSeed + zoned.hour * 7 + zoned.dayOfWeek * 97);
  const reports: SimulatedReport[] = [];

  for (let i = 0; i < maxReports; i++) {
    const roll = rand();
    if (roll >= (targetActivity / 100) * adoptionRate + 0.02) continue;

    const noise = (rand() - 0.5) * 20;
    const activityValue = Math.min(100, Math.max(0, targetActivity + noise));
    const waitNoise = (rand() - 0.5) * 15;
    const waitValue = Math.min(100, Math.max(0, targetWait + waitNoise));

    const ageMinutes = rand() * 45;
    const createdAt = new Date(now.getTime() - ageMinutes * 60_000).toISOString();
    const reporter = reporterProfileIds[Math.floor(rand() * reporterProfileIds.length)];

    reports.push({
      userId: reporter,
      createdAt,
      crowdLevel: activityToCrowdLevel(activityValue),
      waitLevel: waitScoreToLevel(waitValue),
      energyLevel: ENERGY_POOL[Math.floor(rand() * ENERGY_POOL.length)],
      crowdNote: NOTES[Math.floor(rand() * NOTES.length)],
      isVerifiedNearby: rand() < 0.55,
      reportSource: "SIMULATOR",
      trustWeightAtSubmission: 0.4 + rand() * 0.5,
    });
  }

  return reports;
}
