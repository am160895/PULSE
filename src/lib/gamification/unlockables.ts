import type { ContributorLevelName } from "@/types";

/**
 * Architecture only for this pass (spec §15 explicitly scopes this as MVP: "show
 * progression architecture, do not necessarily implement all benefits") — no feature
 * behind any of these is actually built or gated yet. This exists so a future pass has
 * a single place to wire a real gate, and so the level system already has a defined
 * "what does this unlock" surface rather than being purely decorative.
 *
 * Never paywall core map utility — every benefit here is an enhancement on top of the
 * free, fully-functional map/discovery experience, never a requirement to use it.
 */
export type UnlockableBenefit =
  | "EARLIER_TREND_ALERTS"
  | "DEEPER_ACTIVITY_HISTORY"
  | "ADVANCED_VENUE_FORECASTS"
  | "NEIGHBORHOOD_HEAT_ALERTS"
  | "CUSTOM_SAVED_VENUE_ALERTS"
  | "CONTRIBUTOR_ONLY_INSIGHTS";

export const UNLOCKABLE_BENEFIT_REQUIREMENTS: Record<UnlockableBenefit, ContributorLevelName> = {
  EARLIER_TREND_ALERTS: "SCOUT",
  DEEPER_ACTIVITY_HISTORY: "SCOUT",
  ADVANCED_VENUE_FORECASTS: "INSIDER",
  NEIGHBORHOOD_HEAT_ALERTS: "INSIDER",
  CUSTOM_SAVED_VENUE_ALERTS: "LOCAL",
  CONTRIBUTOR_ONLY_INSIGHTS: "PULSE_PRO",
};

const LEVEL_ORDER: ContributorLevelName[] = ["EXPLORER", "SCOUT", "INSIDER", "LOCAL", "PULSE_PRO"];

/** Not called from any real feature gate yet — this is the extension point a future
 * pass wires an actual benefit into, not a live restriction on anything today. */
export function hasUnlockedBenefit(currentLevel: ContributorLevelName, benefit: UnlockableBenefit): boolean {
  return LEVEL_ORDER.indexOf(currentLevel) >= LEVEL_ORDER.indexOf(UNLOCKABLE_BENEFIT_REQUIREMENTS[benefit]);
}
