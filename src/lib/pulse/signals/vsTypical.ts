import type { VenueNightlyRollup, VsTypicalComparison, VsTypicalLabel } from "@/types";
import { VS_TYPICAL_MIN_SAMPLE_NIGHTS, VS_TYPICAL_THRESHOLDS } from "@/config/constants";

/**
 * Compares tonight's current live reading to this venue's own recent same-nightlife-
 * weekday nights. `recentRollups` must already be filtered to the matching
 * nightlifeDayOfWeek by the caller (composeVenue.ts) — this function only aggregates
 * and labels what it's given.
 *
 * Honest limitation, not a bug: rollups are whole-night averages, not hour-matched, so
 * comparing them to a single live in-progress reading will systematically read quieter
 * early in the night and busier late by construction. Display copy must frame this as
 * "vs a typical {weekday} night" (whole-night framing), never claim minute-level
 * precision — same principle this app already applies to peak-time estimates
 * (signals/peak.ts widens its range under low confidence rather than faking a precise minute).
 */
export function calculateVsTypicalSignal(recentRollups: VenueNightlyRollup[], currentPulseScore: number): VsTypicalComparison | null {
  if (recentRollups.length < VS_TYPICAL_MIN_SAMPLE_NIGHTS) return null;

  const typicalScore = recentRollups.reduce((sum, r) => sum + r.avgPulseScore, 0) / recentRollups.length;
  if (typicalScore <= 0) return null;

  const deltaPercent = Math.round(((currentPulseScore - typicalScore) / typicalScore) * 100);
  const label = labelForDelta(deltaPercent);

  return { deltaPercent, label, typicalScore: Math.round(typicalScore), sampleNights: recentRollups.length };
}

function labelForDelta(deltaPercent: number): VsTypicalLabel {
  if (deltaPercent >= VS_TYPICAL_THRESHOLDS.muchBusier) return "MUCH_BUSIER";
  if (deltaPercent >= VS_TYPICAL_THRESHOLDS.busier) return "BUSIER";
  if (deltaPercent <= VS_TYPICAL_THRESHOLDS.muchQuieter) return "MUCH_QUIETER";
  if (deltaPercent <= VS_TYPICAL_THRESHOLDS.quieter) return "QUIETER";
  return "TYPICAL";
}
