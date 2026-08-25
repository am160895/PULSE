import type { UserTrustScore } from "@/types";
import {
  NEW_ACCOUNT_TRUST_PENALTY_DAYS,
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
} from "@/config/constants";

export function initialTrustScore(accountCreatedAt: Date, now: Date): number {
  const accountAgeDays = (now.getTime() - accountCreatedAt.getTime()) / 86_400_000;
  if (accountAgeDays < NEW_ACCOUNT_TRUST_PENALTY_DAYS) {
    return TRUST_SCORE_MIN + (TRUST_SCORE_DEFAULT - TRUST_SCORE_MIN) * (accountAgeDays / NEW_ACCOUNT_TRUST_PENALTY_DAYS);
  }
  return TRUST_SCORE_DEFAULT;
}

/** A report that agreed with the eventual consensus nudges trust up; a flagged one nudges it down. Never public. */
export function applyTrustAdjustment(current: UserTrustScore, outcome: "AGREED" | "FLAGGED"): UserTrustScore {
  const delta = outcome === "AGREED" ? 0.02 : -0.12;
  const trustScore = Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, current.trustScore + delta));
  return {
    ...current,
    trustScore,
    reportsConfirmed: outcome === "AGREED" ? current.reportsConfirmed + 1 : current.reportsConfirmed,
    reportsFlagged: outcome === "FLAGGED" ? current.reportsFlagged + 1 : current.reportsFlagged,
  };
}

export function detectRepetitivePattern(recentValues: string[]): boolean {
  if (recentValues.length < 4) return false;
  const uniqueValues = new Set(recentValues);
  return uniqueValues.size === 1;
}
