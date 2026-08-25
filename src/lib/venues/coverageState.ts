import type { FreshnessLabel, VenueCoverageState } from "@/types";

/**
 * DIRECTORY means "we know this is a real venue but PULSE has no activity data for it at
 * all" (e.g. a Google-only venue never scored) — the UI must show it as a plain listing,
 * never a fabricated score. LIVE/RECENT/TYPICAL otherwise just mirror pulse.freshness
 * (ESTIMATED folds into TYPICAL — both mean "not live," which is all coverage state needs
 * to distinguish for the "NOW" map filter).
 */
export function deriveCoverageState(hasBaselineData: boolean, freshness: FreshnessLabel): VenueCoverageState {
  if (!hasBaselineData) return "DIRECTORY";
  if (freshness === "LIVE") return "LIVE";
  if (freshness === "RECENT") return "RECENT";
  return "TYPICAL";
}

export const VENUE_COVERAGE_STATE_TEXT: Record<VenueCoverageState, string> = {
  LIVE: "Live",
  RECENT: "Recent",
  TYPICAL: "Typical activity",
  DIRECTORY: "No live PULSE yet",
};
