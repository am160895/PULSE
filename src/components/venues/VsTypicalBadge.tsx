import type { VsTypicalComparison } from "@/types";

const STYLES: Record<VsTypicalComparison["label"], { bg: string; color: string; text: (pct: number) => string }> = {
  MUCH_BUSIER: { bg: "var(--hot-soft)", color: "var(--hot)", text: (p) => `${p}% busier than usual` },
  BUSIER: { bg: "var(--rising-soft)", color: "var(--rising)", text: (p) => `${p}% busier than usual` },
  TYPICAL: { bg: "var(--surface-3)", color: "var(--text-secondary)", text: () => "Typical for tonight" },
  QUIETER: { bg: "var(--quiet-soft)", color: "var(--text-muted)", text: (p) => `${Math.abs(p)}% quieter than usual` },
  MUCH_QUIETER: { bg: "var(--quiet-soft)", color: "var(--text-muted)", text: (p) => `${Math.abs(p)}% quieter than usual` },
};

/** "vs a typical night" framing, not a precise live measurement — see
 * lib/pulse/signals/vsTypical.ts for why (whole-night rollup averages, not hour-matched). */
export function VsTypicalBadge({ comparison }: { comparison: VsTypicalComparison }) {
  const s = STYLES[comparison.label];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {s.text(comparison.deltaPercent)}
    </span>
  );
}
