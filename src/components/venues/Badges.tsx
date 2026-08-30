import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, Minus } from "lucide-react";
import type { ConfidenceLabel, FreshnessLabel, PulseLabel, TrendDirection, VenueOpenState, VenueOpenStatus, WaitEstimate } from "@/types";
import { PULSE_LABEL_TEXT, TREND_TEXT } from "@/lib/pulse/labels";
import { formatWaitEstimate } from "@/lib/pulse/waitEstimate";
import { VENUE_OPEN_STATE_TEXT } from "@/lib/venues/openState";

export function markerClassForLabel(label: PulseLabel): string {
  switch (label) {
    case "HOT_NOW":
      return "hot";
    case "VERY_ACTIVE":
      return "rising";
    case "BUSY":
      return "active";
    case "MODERATE":
      return "moderate";
    default:
      return "quiet";
  }
}

// Same grey → tan → orange → deep-orange → red intensity ramp as the map markers
// (globals.css's --level-* variables) — one color language for "how busy" everywhere it
// shows up, not just on the map.
export function PulseLabelBadge({ label }: { label: PulseLabel }) {
  const cls = markerClassForLabel(label);
  const styles: Record<string, { bg: string; color: string }> = {
    hot: { bg: "var(--level-hot-soft)", color: "var(--level-hot)" },
    rising: { bg: "var(--level-very-active-soft)", color: "var(--level-very-active)" },
    active: { bg: "var(--level-busy-soft)", color: "var(--level-busy)" },
    moderate: { bg: "var(--level-moderate-soft)", color: "var(--level-moderate)" },
    quiet: { bg: "var(--level-quiet-soft)", color: "var(--level-quiet)" },
  };
  const s = styles[cls];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {PULSE_LABEL_TEXT[label]}
    </span>
  );
}

export function ConfidenceBadge({ label }: { label: ConfidenceLabel }) {
  const cls = label === "HIGH" ? "badge-high" : label === "MEDIUM" ? "badge-medium" : "badge-low";
  return <span className={`badge ${cls}`}>{label.charAt(0) + label.slice(1).toLowerCase()} confidence</span>;
}

export function FreshnessBadge({ label }: { label: FreshnessLabel }) {
  if (label === "LIVE") return <span className="badge badge-live">Live</span>;
  const text = label === "RECENT" ? "Recent" : label === "ESTIMATED" ? "Estimated" : "Typical activity";
  return <span className="badge badge-low">{text}</span>;
}

export function TrendIndicator({ trend, delta }: { trend: TrendDirection; delta: number }) {
  const config: Record<TrendDirection, { icon: React.ReactNode; color: string }> = {
    RISING_FAST: { icon: <ArrowUp size={13} />, color: "var(--hot)" },
    RISING: { icon: <ArrowUpRight size={13} />, color: "var(--rising)" },
    STABLE: { icon: <Minus size={13} />, color: "var(--text-muted)" },
    FALLING: { icon: <ArrowDownRight size={13} />, color: "var(--text-secondary)" },
    FALLING_FAST: { icon: <ArrowDown size={13} />, color: "var(--text-secondary)" },
  };
  const c = config[trend];
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: c.color }}>
      {c.icon}
      {TREND_TEXT[trend]}
      {delta !== 0 && (
        <span className="text-[var(--text-muted)]">
          {delta > 0 ? "+" : ""}
          {delta} / 30m
        </span>
      )}
    </span>
  );
}

export function WaitBadge({ estimate }: { estimate: WaitEstimate | null }) {
  return <span className="text-[13px] text-[var(--text-secondary)]">{formatWaitEstimate(estimate)}</span>;
}

/** Only rendered for non-OPEN states — an open venue doesn't need a badge announcing the obvious. */
export function OpenStateBadge({ state }: { state: VenueOpenState }) {
  if (state === "OPEN") return null;
  const cls = state === "CLOSING_SOON" ? "badge-medium" : state === "UNKNOWN" ? "badge-low" : "badge-low";
  return <span className={`badge ${cls}`}>{VENUE_OPEN_STATE_TEXT[state]}</span>;
}

const SCORE_COLOR: Record<string, string> = {
  hot: "var(--level-hot)",
  rising: "var(--level-very-active)",
  active: "var(--level-busy)",
  moderate: "var(--level-moderate)",
  quiet: "var(--level-quiet)",
};

function formatVenueLocalTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

/**
 * Renders in place of a live score whenever currentPulseStatus is CLOSED — a closed venue
 * must never show a normal-looking Pulse Score (spec §22/§27), even one that happens to
 * compute to 0. Keeps the historical "typical peak" context (also computed while closed,
 * see calculatePulseScore.ts) rather than just going blank.
 */
export function ClosedVenueStatus({
  openStatus,
  expectedPeak,
  timeZone,
}: {
  openStatus: VenueOpenStatus;
  expectedPeak: { start: string; end: string } | null;
  timeZone: string;
}) {
  return (
    <div className="mb-4 py-3 border-y border-[var(--border)]">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="badge badge-low">{openStatus.displayText}</span>
      </div>
      {expectedPeak && (
        <p className="text-[13px] text-[var(--text-secondary)]">
          Typical peak: {formatVenueLocalTime(expectedPeak.start, timeZone)}–{formatVenueLocalTime(expectedPeak.end, timeZone)}
        </p>
      )}
    </div>
  );
}

export function PulseScoreDisplay({ score, label }: { score: number; label: PulseLabel }) {
  const color = SCORE_COLOR[markerClassForLabel(label)];
  return (
    <div>
      <div className="pulse-score-number" style={{ color }}>
        {score}
      </div>
      <div className="pulse-score-label" style={{ color }}>
        {PULSE_LABEL_TEXT[label]}
      </div>
    </div>
  );
}
