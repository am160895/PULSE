import type { PulseLabel, TrendDirection } from "@/types";
import { PULSE_LABEL_BANDS } from "@/config/constants";

export function pulseLabelForScore(score: number): PulseLabel {
  return PULSE_LABEL_BANDS.find((band) => score >= band.min)?.label ?? "VERY_QUIET";
}

export const PULSE_LABEL_TEXT: Record<PulseLabel, string> = {
  HOT_NOW: "Hot now",
  VERY_ACTIVE: "Very active",
  BUSY: "Busy",
  MODERATE: "Moderate",
  QUIET: "Quiet",
  VERY_QUIET: "Very quiet",
};

export const TREND_TEXT: Record<TrendDirection, string> = {
  RISING_FAST: "Rising fast",
  RISING: "Rising",
  STABLE: "Stable",
  FALLING: "Falling",
  FALLING_FAST: "Falling fast",
};
