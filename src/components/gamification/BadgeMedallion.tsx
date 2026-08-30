"use client";

/**
 * One shared visual family for every badge — dark circular medallions with clean
 * geometric line art, never cartoon clipart (spec §36). `motif` comes straight from the
 * `badges` table so new badges added later just need a motif string handled here, not a
 * whole new component.
 */

const STROKE_WIDTH = 1.6;

function RadiatingDot() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round">
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </g>
    </svg>
  );
}

function RisingLine() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17 L10 11 L14 14 L20 6" />
      <path d="M14 6h6v6" />
    </svg>
  );
}

function MinimalClock() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

function AbstractMoon() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="currentColor">
      <path d="M15.5 4.5a8 8 0 1 0 4 12.9A9.5 9.5 0 0 1 15.5 4.5Z" />
    </svg>
  );
}

function ConcentricPulse() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH}>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6" opacity="0.7" />
      <circle cx="12" cy="12" r="9.5" opacity="0.35" />
    </svg>
  );
}

function LocationSignal() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FoundingSeal() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" opacity="0.5" />
      <path d="M12 6.5 13.4 10.2 17.2 10.4 14.2 12.9 15.3 16.6 12 14.4 8.7 16.6 9.8 12.9 6.8 10.4 10.6 10.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const MOTIFS: Record<string, () => React.ReactElement> = {
  "radiating-dot": RadiatingDot,
  "rising-line": RisingLine,
  "minimal-clock": MinimalClock,
  "abstract-moon": AbstractMoon,
  "concentric-pulse": ConcentricPulse,
  "location-signal": LocationSignal,
  "founding-seal": FoundingSeal,
};

export function BadgeMedallion({ motif, size = 44, unlocked = true }: { motif: string; size?: number; unlocked?: boolean }) {
  const Icon = MOTIFS[motif] ?? ConcentricPulse;
  return (
    <div className={`badge-medallion${unlocked ? " unlocked" : ""}`} style={{ width: size, height: size, opacity: unlocked ? 1 : 0.45 }}>
      <Icon />
    </div>
  );
}
