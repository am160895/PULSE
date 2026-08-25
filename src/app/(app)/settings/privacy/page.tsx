"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PresencePreferences, Profile, Visibility } from "@/types";
import { PRESENCE_MAX_TIMEOUT_MINUTES } from "@/config/constants";
import { requestJson } from "@/lib/http/requestJson";

export default function PrivacySettingsPage() {
  const [preferences, setPreferences] = useState<PresencePreferences | null>(null);
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadPreferences() {
    return requestJson<{ preferences: PresencePreferences; blocked: Profile[] }>("/api/privacy").then((result) => {
      if (!result.ok) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setPreferences(result.data.preferences);
      setBlocked(result.data.blocked ?? []);
    });
  }

  // The effect only kicks off the fetch — state updates happen inside its .then(), not
  // synchronously in the effect body itself (React flags synchronous setState there as a
  // cascading-render risk). Retry's setLoadError(false) is fine since it's an event handler.
  useEffect(() => {
    loadPreferences();
  }, []);

  function retry() {
    setLoadError(false);
    loadPreferences();
  }

  async function update(patch: Partial<PresencePreferences>) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, ...patch });
    setSaved(false);
    setError(null);

    const result = await requestJson("/api/privacy", { method: "PATCH", body: patch });
    if (!result.ok) {
      setPreferences(previous); // roll back — the toggle must not look "on" when it never persisted
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function unblock(profileId: string) {
    const result = await requestJson("/api/friends/unblock", { method: "POST", body: { profileId } });
    if (result.ok) setBlocked((prev) => prev.filter((p) => p.id !== profileId));
    else setError(result.error);
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto px-5 py-6">
        <p className="text-[14px] text-[var(--text-secondary)] mb-3">Couldn&apos;t load privacy settings.</p>
        <button className="btn btn-secondary" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  if (!preferences) return <div className="max-w-lg mx-auto px-5 py-6">Loading…</div>;

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-10">
      <Link href="/you" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] mb-4">
        <ArrowLeft size={14} /> You
      </Link>
      <h1 className="mb-1">Privacy</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">
        Presence is off by default. Nothing here is shared unless you turn it on, and every share expires
        automatically.
      </p>

      <Field label="Share that I'm at a venue" checked={preferences.allowVenuePresence} onChange={(v) => update({ allowVenuePresence: v })} />
      <Field label="Share that I'm nearby a venue" checked={preferences.allowNearbyPresence} onChange={(v) => update({ allowNearbyPresence: v })} />
      <Field label="Share that I was recently at a venue" checked={preferences.allowRecentPresence} onChange={(v) => update({ allowRecentPresence: v })} />

      <div className="mb-5">
        <p className="text-[13px] font-medium mb-2">Default audience</p>
        <select
          className="input"
          value={preferences.defaultVisibility}
          onChange={(e) => update({ defaultVisibility: e.target.value as Visibility })}
        >
          <option value="PRIVATE">Private (nobody)</option>
          <option value="FRIENDS">Friends</option>
          <option value="CLOSE_FRIENDS">Close friends only</option>
        </select>
      </div>

      <div className="mb-6">
        <p className="text-[13px] font-medium mb-2">
          Auto-expire after {preferences.presenceTimeoutMinutes} minutes
        </p>
        <input
          type="range"
          min={15}
          max={PRESENCE_MAX_TIMEOUT_MINUTES}
          step={15}
          value={preferences.presenceTimeoutMinutes}
          onChange={(e) => update({ presenceTimeoutMinutes: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {saved && <p className="text-[13px] mb-4" style={{ color: "var(--active)" }}>Saved</p>}
      {error && <p className="text-[13px] mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      <div>
        <p className="text-[13px] font-medium mb-2">Blocked users</p>
        {blocked.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">Nobody blocked.</p>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] divide-y divide-[var(--border)]">
            {blocked.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-[14px]">
                <span>{p.displayName}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => unblock(p.id)}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-3 border-b border-[var(--border)] text-[14px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}
