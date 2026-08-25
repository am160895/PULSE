import type { WaitEstimate, WaitLevel } from "@/types";
import { WAIT_LEVEL_RANGES } from "@/config/constants";
import type { WeightedReport } from "./signals/liveReports";

const WAIT_LEVELS: WaitLevel[] = ["NONE", "SHORT", "MEDIUM", "LONG", "VERY_LONG"];

export function estimateWaitFromReports(weighted: WeightedReport[]): WaitEstimate | null {
  if (weighted.length === 0) return null;

  const votes = new Map<WaitLevel, number>();
  for (const w of weighted) {
    votes.set(w.report.waitLevel, (votes.get(w.report.waitLevel) ?? 0) + w.weight);
  }

  let bestLevel: WaitLevel = "NONE";
  let bestWeight = -1;
  for (const level of WAIT_LEVELS) {
    const weight = votes.get(level) ?? 0;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestLevel = level;
    }
  }

  const range = WAIT_LEVEL_RANGES[bestLevel];
  return { minMinutes: range.min, maxMinutes: range.max };
}

export function estimateWaitFromHistorical(historicalWaitScore: number): WaitEstimate | null {
  if (historicalWaitScore < 15) return null; // not worth surfacing a guess this weak
  let level: WaitLevel;
  if (historicalWaitScore < 30) level = "SHORT";
  else if (historicalWaitScore < 55) level = "MEDIUM";
  else if (historicalWaitScore < 78) level = "LONG";
  else level = "VERY_LONG";

  const range = WAIT_LEVEL_RANGES[level];
  return { minMinutes: range.min, maxMinutes: range.max };
}

export function formatWaitEstimate(estimate: WaitEstimate | null): string {
  if (!estimate) return "No wait estimate";
  if (estimate.maxMinutes === null) return `${estimate.minMinutes}+ min`;
  if (estimate.minMinutes === 0 && estimate.maxMinutes <= 5) return "No wait";
  return `${estimate.minMinutes}–${estimate.maxMinutes} min`;
}
