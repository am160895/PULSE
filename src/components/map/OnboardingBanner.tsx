"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "pulse_onboarding_dismissed";

function subscribe() {
  return () => {};
}
// Server (and the client's first hydration pass) always sees "dismissed" — the real
// localStorage value is only readable client-side, and useSyncExternalStore's contract is
// exactly built for "render the server snapshot first, then reconcile after hydration"
// without the hydration-mismatch flash a useEffect+setState version would risk.
function getServerSnapshot() {
  return true;
}
function getDismissedSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return true; // can't read storage reliably — don't show rather than risk showing every load
  }
}

/**
 * First-visit-only, five-second explainer for the map (growth spec's minimal onboarding
 * requirement) — never a multi-page flow, never a modal blocking the map itself. Persisted
 * in localStorage (this device only, nothing sent anywhere) so it shows once, ever.
 */
export function OnboardingBanner() {
  const dismissed = useSyncExternalStore(subscribe, getDismissedSnapshot, getServerSnapshot);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  function dismiss() {
    setManuallyDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // best-effort — worst case it shows again next visit, not worth surfacing an error for
    }
  }

  if (dismissed || manuallyDismissed) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[15] mx-auto max-w-md rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 flex items-start gap-3"
      style={{ top: "calc(env(safe-area-inset-top) + 156px)", background: "rgba(17,21,26,0.94)", backdropFilter: "blur(6px)" }}
    >
      <p className="flex-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        <span className="font-medium" style={{ color: "var(--text)" }}>
          Scores show how busy it is right now.
        </span>{" "}
        Grey is quiet, orange is active, red is packed. An arrow means it&apos;s changing fast.
      </p>
      <button onClick={dismiss} aria-label="Dismiss" style={{ color: "var(--text-muted)" }}>
        <X size={16} />
      </button>
    </div>
  );
}
