import type { ContributorLevel, Venue, VenueReport, XpRewardType } from "@/types";
import { XP_VALUES } from "@/config/constants";
import { REPORT_COOLDOWN_MINUTES } from "@/config/constants";
import { getUserProgress, insertXpEvent } from "@/lib/data/gamification";
import { levelForXp } from "./levels";

export interface AwardXpInput {
  userId: string;
  rewardType: XpRewardType;
  sourceId: string;
  venueId?: string | null;
  neighborhood?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AwardXpResult {
  awarded: boolean;
  xpAmount: number;
  totalXp: number;
  level: ContributorLevel;
  leveledUp: boolean;
}

/**
 * The one place XP is ever awarded — server-decided, never trusted from the client. Every
 * award is an xp_events insert; a database trigger atomically bumps user_progress (and
 * user_neighborhood_progress, when a neighborhood is given) in the same transaction, so
 * the running total can never drift from the ledger that justifies it. Idempotent: a
 * duplicate (userId, sourceId, rewardType) — a retried request, or a report already
 * rewarded — awards nothing and never re-fires a level-up celebration.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const xpAmount = XP_VALUES[input.rewardType];
  const event = await insertXpEvent({
    userId: input.userId,
    rewardType: input.rewardType,
    xpAmount,
    sourceId: input.sourceId,
    venueId: input.venueId ?? null,
    neighborhood: input.neighborhood ?? null,
    metadata: input.metadata,
  });

  const progress = await getUserProgress(input.userId);
  if (!event) {
    return { awarded: false, xpAmount: 0, totalXp: progress.totalXp, level: levelForXp(progress.totalXp), leveledUp: false };
  }

  const totalXp = progress.totalXp;
  const levelBefore = levelForXp(totalXp - xpAmount);
  const levelAfter = levelForXp(totalXp);
  return { awarded: true, xpAmount, totalXp, level: levelAfter, leveledUp: levelBefore.name !== levelAfter.name };
}

/** Deterministic 25-minute wall-clock bucket, reusing the existing report-cooldown
 * constant rather than inventing a near-duplicate. A repeat "I'm Here" for the same venue
 * within the same bucket hits xp_events' existing idempotency index and earns 0 XP — the
 * anti-farming cooldown reports get for free from their own DB exclusion constraint,
 * applied here to the one contribution type that has no such constraint of its own. */
export function presenceSourceId(userId: string, venueId: string, now: Date): string {
  const bucket = Math.floor(now.getTime() / (REPORT_COOLDOWN_MINUTES * 60_000));
  return `presence:${userId}:${venueId}:${bucket}`;
}

export async function awardXpForPresence(userId: string, venue: Venue, now: Date): Promise<AwardXpResult> {
  return awardXp({
    userId,
    rewardType: "I_AM_HERE",
    sourceId: presenceSourceId(userId, venue.id, now),
    venueId: venue.id,
    neighborhood: venue.neighborhood,
  });
}

export interface ReportXpBreakdown {
  results: Partial<Record<XpRewardType, AwardXpResult>>;
  totalXpAwarded: number;
  finalTotalXp: number;
  finalLevel: ContributorLevel;
  leveledUp: boolean;
}

/**
 * Awards the full XP batch for one report submission — one report legitimately produces
 * several xp_events rows (CROWD_REPORT/WAIT_REPORT/ENERGY_REPORT always; LIVE_NOTE and
 * FIRST_REPORT_TONIGHT conditionally), all sharing sourceId = report.id and distinguished
 * by rewardType. No report-side cooldown/reduced-XP logic exists here deliberately: the
 * existing 25-minute DB exclusion constraint on venue_reports already makes a same-user-
 * same-venue repeat report impossible before it ever reaches this function, so there is no
 * "repeat report" case left for XP-side cooldown logic to guard against.
 */
export async function awardXpForReport(
  userId: string,
  report: VenueReport,
  venue: Venue,
  isFirstReportTonight: boolean
): Promise<ReportXpBreakdown> {
  const rewardTypes: XpRewardType[] = ["CROWD_REPORT", "WAIT_REPORT", "ENERGY_REPORT"];
  if (report.crowdNote) rewardTypes.push("LIVE_NOTE");
  if (isFirstReportTonight) rewardTypes.push("FIRST_REPORT_TONIGHT");

  const results: Partial<Record<XpRewardType, AwardXpResult>> = {};
  let totalXpAwarded = 0;
  let leveledUp = false;
  let last: AwardXpResult | null = null;

  // Sequential, not parallel: each award reads the just-updated running total, so
  // level-up detection stays correct across this multi-reward batch from one report.
  for (const rewardType of rewardTypes) {
    const result = await awardXp({
      userId,
      rewardType,
      sourceId: report.id,
      venueId: venue.id,
      neighborhood: venue.neighborhood,
      metadata: rewardType === "WAIT_REPORT" ? { waitLevel: report.waitLevel } : undefined,
    });
    results[rewardType] = result;
    if (result.awarded) totalXpAwarded += result.xpAmount;
    if (result.leveledUp) leveledUp = true;
    last = result;
  }

  return { results, totalXpAwarded, finalTotalXp: last!.totalXp, finalLevel: last!.level, leveledUp };
}
