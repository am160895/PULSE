import type { FreshnessLabel, VenueCoverageState } from "@/types";

/**
 * DIRECTORY means "we know this is a real venue but PULSE has no activity data for it at
 * all" (e.g. a Google-only venue never scored, or a freshly-imported real venue nobody's
 * reported at yet) — the UI must show it as a plain listing, never a fabricated score.
 *
 * A fresh report is checked FIRST, before baseline history — a brand-new venue has zero
 * accumulated historical baselines by definition (those only exist once nights of real
 * reports have piled up), but that must never mask a report someone submits THIS SECOND.
 * Getting this order backwards was a real, live bug: every one of this app's freshly
 * imported venues has no baseline rows yet, so the old "no baseline -> DIRECTORY" check
 * fired unconditionally and threw away a same-second LIVE report, showing "No live PULSE
 * yet" on a venue that had just been reported on.
 */
export function deriveCoverageState(hasBaselineData: boolean, freshness: FreshnessLabel): VenueCoverageState {
  if (freshness === "LIVE") return "LIVE";
  if (freshness === "RECENT") return "RECENT";
  if (!hasBaselineData) return "DIRECTORY";
  return "TYPICAL";
}

export const VENUE_COVERAGE_STATE_TEXT: Record<VenueCoverageState, string> = {
  LIVE: "Live",
  RECENT: "Recent",
  TYPICAL: "Typical activity",
  DIRECTORY: "No live PULSE yet",
};
