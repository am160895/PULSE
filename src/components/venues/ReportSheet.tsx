"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { BadgeCode, ContributorLevel, CrowdLevel, EnergyLevel, PulseResult, WaitLevel } from "@/types";
import type { ImpactMessage } from "@/lib/pulse/impactMessage";
import { requestJson } from "@/lib/http/requestJson";
import { getUserLocationOnce } from "@/lib/geo/userLocation";

export interface ReportSubmitResult {
  reportId: string;
  pulse: PulseResult;
  flaggedForReview: boolean;
  xp: { totalXpAwarded: number; totalXp: number; level: ContributorLevel; leveledUp: boolean };
  badgesUnlocked: Array<{ code: BadgeCode; neighborhood: string; xpEventId: string | null }>;
  impactMessage: ImpactMessage;
}

const CROWD_OPTIONS: { value: CrowdLevel; label: string }[] = [
  { value: "QUIET", label: "Quiet" },
  { value: "MODERATE", label: "Moderate" },
  { value: "BUSY", label: "Busy" },
  { value: "PACKED", label: "Packed" },
];

const WAIT_OPTIONS: { value: WaitLevel; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "SHORT", label: "<10 min" },
  { value: "MEDIUM", label: "10–20 min" },
  { value: "LONG", label: "20+ min" },
];

const ENERGY_OPTIONS: { value: EnergyLevel; label: string }[] = [
  { value: "CHILL", label: "Chill" },
  { value: "GOOD", label: "Good" },
  { value: "HIGH", label: "High" },
];

interface Props {
  venueId: string;
  onClose: () => void;
  onSubmitted: (result: ReportSubmitResult, reportedShareArrival: boolean) => void;
  onAnonymous: () => void;
}

export function ReportSheet({ venueId, onClose, onSubmitted, onAnonymous }: Props) {
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel | null>(null);
  const [waitLevel, setWaitLevel] = useState<WaitLevel | null>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null);
  const [note, setNote] = useState("");
  const [shareArrival, setShareArrival] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = crowdLevel && waitLevel && energyLevel && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    // Shared, session-cached lookup (see lib/geo/userLocation.ts) — this used to call
    // getCurrentPosition fresh on every single report submission, independently of the
    // map/Explore pages' own lookups, which meant the browser could be asked for location
    // repeatedly as someone moved between screens and reported. Undefined here (denied or
    // unavailable) still lets the report submit, just unverified.
    const loc = await getUserLocationOnce();
    const userLocation = loc ?? undefined;

    const result = await requestJson<ReportSubmitResult>(`/api/venues/${venueId}/reports`, {
      method: "POST",
      body: { crowdLevel, waitLevel, energyLevel, crowdNote: note || undefined, userLocation },
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.code === "ANONYMOUS_SESSION") {
        onAnonymous();
        return;
      }
      setError(result.error);
      return;
    }

    if (shareArrival) {
      // Best-effort: presence sharing might be off in settings, in which case this
      // 403s quietly — the report itself already succeeded either way. Its own XP (if
      // any) is intentionally not surfaced here — the report's own success toast is the
      // one moment of feedback for this submission, not two overlapping toasts.
      await requestJson("/api/presence", {
        method: "POST",
        body: { venueId, status: "AT_VENUE", visibility: "FRIENDS" },
      });
    }

    setSubmitting(false);
    onSubmitted(result.data, shareArrival);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 pb-16" onClick={onClose}>
      <div className="venue-sheet w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Close">
          <X size={18} />
        </button>
        <div className="px-5 pb-6 pt-1">
          <h3 className="mb-4">How is it right now?</h3>

          <OptionGroup label="How busy?" options={CROWD_OPTIONS} value={crowdLevel} onChange={setCrowdLevel} />
          <OptionGroup label="Wait?" options={WAIT_OPTIONS} value={waitLevel} onChange={setWaitLevel} />
          <OptionGroup label="Energy?" options={ENERGY_OPTIONS} value={energyLevel} onChange={setEnergyLevel} />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 100))}
            placeholder="Add a short note (optional)"
            className="input mt-1 mb-3"
            maxLength={100}
          />

          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] mb-4">
            <input type="checkbox" checked={shareArrival} onChange={(e) => setShareArrival(e.target.checked)} />
            Also let friends see I&apos;m here (expires automatically)
          </label>

          {error && <p className="text-sm mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

          <button className="btn btn-primary w-full" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`filter-chip ${value === opt.value ? "active" : ""}`}
            style={{ background: value === opt.value ? "var(--text)" : "var(--surface-2)" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
