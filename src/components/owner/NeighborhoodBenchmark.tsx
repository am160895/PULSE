import type { NeighborhoodBenchmark as NeighborhoodBenchmarkData } from "@/hooks/api";

export function NeighborhoodBenchmark({ venuePulseScore, benchmark }: { venuePulseScore: number; benchmark: NeighborhoodBenchmarkData | null }) {
  if (!benchmark) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        Not enough nearby venues with history yet to show a neighborhood comparison.
      </p>
    );
  }

  const deltaPercent = benchmark.averageScore > 0 ? Math.round(((venuePulseScore - benchmark.averageScore) / benchmark.averageScore) * 100) : 0;

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] px-3.5 py-3">
      <div>
        <p className="text-[13px] font-medium">Neighborhood average tonight</p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Across {benchmark.venueCount} other venue{benchmark.venueCount === 1 ? "" : "s"} with history
        </p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-bold tabular-nums">{benchmark.averageScore}</p>
        <p className="text-[11px]" style={{ color: deltaPercent >= 0 ? "var(--rising)" : "var(--text-muted)" }}>
          {deltaPercent >= 0 ? "+" : ""}
          {deltaPercent}% vs you
        </p>
      </div>
    </div>
  );
}
