"use client";

import { useEffect, useState } from "react";
import type { FoundingScoutConfig } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { LoadingDots } from "@/components/ui/States";

export function FoundingScoutSettings() {
  const [config, setConfig] = useState<FoundingScoutConfig | null>(null);
  const [maxCountInput, setMaxCountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    requestJson<{ config: FoundingScoutConfig }>("/api/admin/founding-scout").then((result) => {
      if (result.ok) {
        setConfig(result.data.config);
        setMaxCountInput(String(result.data.config.maxCount));
      } else {
        setError(result.error);
      }
    });
  }

  useEffect(load, []);

  async function save(patch: Partial<Pick<FoundingScoutConfig, "enabled" | "maxCount">>) {
    setSaving(true);
    const result = await requestJson<{ config: FoundingScoutConfig }>("/api/admin/founding-scout", {
      method: "PATCH",
      body: patch,
    });
    setSaving(false);
    if (result.ok) {
      setConfig(result.data.config);
      setMaxCountInput(String(result.data.config.maxCount));
    } else {
      setError(result.error);
    }
  }

  if (!config) return error ? <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p> : <LoadingDots />;

  const full = config.awardedCount >= config.maxCount;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="mb-1">Founding Scout program</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Awarded automatically to the first N users who make a real contribution — not
            just for signing up.
          </p>
        </div>
        <button
          onClick={() => save({ enabled: !config.enabled })}
          disabled={saving}
          className={`btn btn-sm ${config.enabled ? "btn-primary" : "btn-ghost"}`}
        >
          {config.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] text-[var(--text-secondary)]">Awarded so far</span>
        <span className="font-medium">
          {config.awardedCount} / {config.maxCount}
          {full && <span className="badge ml-2">Full</span>}
        </span>
      </div>

      <label className="block text-[13px] text-[var(--text-secondary)] mb-1">Maximum count</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={config.awardedCount}
          value={maxCountInput}
          onChange={(e) => setMaxCountInput(e.target.value)}
          className="input"
        />
        <button
          onClick={() => save({ maxCount: Number(maxCountInput) })}
          disabled={saving || Number(maxCountInput) === config.maxCount || !Number.isFinite(Number(maxCountInput))}
          className="btn btn-secondary btn-sm"
        >
          Save
        </button>
      </div>

      {error && <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
