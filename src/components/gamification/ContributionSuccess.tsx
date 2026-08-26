"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { XpPop } from "./XpPop";
import { ProgressBar } from "./ProgressBar";

export interface ContributionSuccessProps {
  title: string;
  message?: string;
  xpEarned?: number;
  badgeUnlocked?: { name: string } | null;
  progressUpdate?: { label: string; current: number; target: number | null } | null;
  impactMessage?: string | null;
  onDismiss: () => void;
  /** ~500-900ms of animation, then a few seconds to actually read it — never several
   * seconds of dead waiting before anything shows (spec §1). */
  autoDismissMs?: number;
}

/**
 * The one reusable success toast for every meaningful contribution (I'm Here, reports,
 * saves, friend requests, corrections) — spec §2. Only ever mount this AFTER the server
 * has confirmed the action; never render it optimistically before that confirmation.
 */
export function ContributionSuccess({
  title,
  message,
  xpEarned,
  badgeUnlocked,
  progressUpdate,
  impactMessage,
  onDismiss,
  autoDismissMs = 3600,
}: ContributionSuccessProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  return (
    <div
      className="contribution-success fixed left-3 right-3 z-[150] mx-auto max-w-md px-4 py-3.5"
      style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="success-check">
          <Check size={17} strokeWidth={3} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold" style={{ fontSize: 13, letterSpacing: "0.02em" }}>
              {title}
            </p>
            {typeof xpEarned === "number" && xpEarned > 0 && <XpPop amount={xpEarned} key={xpEarned} />}
          </div>
          {message && (
            <p className="mt-0.5" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {message}
            </p>
          )}
          {impactMessage && (
            <p className="mt-1" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {impactMessage}
            </p>
          )}
          {badgeUnlocked && (
            <p className="mt-1.5 font-medium" style={{ fontSize: 12.5, color: "var(--accent)" }}>
              Badge unlocked · {badgeUnlocked.name}
            </p>
          )}
          {progressUpdate && (
            <div className="mt-2.5">
              <ProgressBar current={progressUpdate.current} target={progressUpdate.target} label={progressUpdate.label} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
