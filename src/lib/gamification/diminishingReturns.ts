function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * A venue everyone's already reporting on shouldn't pay the same XP as one nobody's
 * looked at yet — this directs supply toward genuine information gaps instead of piling
 * more confirmation onto a venue that's already well-covered. Uses confidenceScore
 * BEFORE this report is applied (the caller already computes this pre-report for the
 * impact message, so there's no extra query), not sourceDiversity/state directly — those
 * live on signalHealth, which is one recompute away from the pulse score itself and
 * isn't worth threading through here just for this.
 */
export function coverageXpMultiplier(confidenceScoreBefore: number): number {
  const t = clamp((confidenceScoreBefore - 30) / 60, 0, 1);
  return 1 - t * 0.5; // 1.0x at confidenceScore<=30 (sparse), floor 0.5x at >=90 (saturated)
}
