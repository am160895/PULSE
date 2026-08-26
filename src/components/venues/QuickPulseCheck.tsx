"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { CrowdLevel, EnergyLevel, WaitLevel } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { getUserLocationOnce } from "@/lib/geo/userLocation";
import type { ReportSubmitResult } from "./ReportSheet";

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
  onSubmitted: (result: ReportSubmitResult) => void;
}

/**
 * A fast, single-tap-per-question flow shown right after "I'm Here" — one question at a
 * time, each tap auto-advancing, no separate submit button ("one tap, no lengthy
 * survey"). The last answer submits through the exact same /api/venues/[id]/reports
 * endpoint the full Report sheet uses, so it earns the same XP, badge evaluation, and
 * impact messaging — meaningfully more than I'm Here's own +10 alone — without a second,
 * parallel data model to maintain. Entirely optional: closing or skipping at any point
 * loses nothing already earned from I'm Here itself.
 */
export function QuickPulseCheck({ venueId, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState(0);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel | null>(null);
  const [waitLevel, setWaitLevel] = useState<WaitLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnergyPick(energyLevel: EnergyLevel) {
    if (!crowdLevel || !waitLevel || submitting) return;
    setSubmitting(true);
    setError(null);

    const loc = await getUserLocationOnce();
    const result = await requestJson<ReportSubmitResult>(`/api/venues/${venueId}/reports`, {
      method: "POST",
      body: { crowdLevel, waitLevel, energyLevel, userLocation: loc ?? undefined },
    });

    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    onSubmitted(result.data);
  }

  const steps = [
    {
      question: "How busy is it?",
      render: () => <OptionRow options={CROWD_OPTIONS} onPick={(v: CrowdLevel) => { setCrowdLevel(v); setStep(1); }} />,
    },
    {
      question: "How's the wait?",
      render: () => <OptionRow options={WAIT_OPTIONS} onPick={(v: WaitLevel) => { setWaitLevel(v); setStep(2); }} />,
    },
    {
      question: "What's the energy?",
      render: () => <OptionRow options={ENERGY_OPTIONS} onPick={handleEnergyPick} />,
    },
  ];
  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/50 pb-16" onClick={submitting ? undefined : onClose}>
      <div className="venue-sheet w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Skip" disabled={submitting}>
          <X size={18} />
        </button>
        <div className="px-5 pb-6 pt-1">
          <div className="flex gap-1.5 mb-5">
            {steps.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--accent)" : "var(--surface-3)" }} />
            ))}
          </div>
          <h3 className="mb-4">{submitting ? "Submitting…" : current.question}</h3>
          {!submitting && current.render()}
          {error && (
            <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <button onClick={onClose} className="mt-5 text-[13px]" style={{ color: "var(--text-muted)" }} disabled={submitting}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow<T extends string>({ options, onPick }: { options: { value: T; label: string }[]; onPick: (v: T) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          className="filter-chip"
          style={{ background: "var(--surface-2)", height: 44, fontSize: 14 }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
