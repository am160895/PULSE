"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  /** Shown after "Create a free account". Keep it specific to the action that triggered
   * this prompt (e.g. "to save venues") — a generic prompt is less convincing. */
  reason: string;
  /** The write action that got interrupted (e.g. "report") — carried through as
   * `?intent=` on the `next` redirect so the destination page can resume it automatically
   * once the visitor is actually authenticated, instead of just landing them back on a
   * blank page (growth spec: "return to exact prior context after authenticating"). */
  intent?: string;
}

/** Shown wherever an anonymous browsing session hits a write action it can't perform (see
 * ANONYMOUS_SESSION in lib/auth/index.ts) — one shared component so every call site looks
 * and behaves the same. Links carry `next` back to the current page, mirroring proxy.ts's
 * own next-param convention, so signing up doesn't strand the visitor on /map. */
export function SignUpPrompt({ onClose, reason, intent }: Props) {
  const path = typeof window !== "undefined" ? window.location.pathname : "/map";
  const next = intent ? `${path}?intent=${encodeURIComponent(intent)}` : path;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 pb-16" onClick={onClose}>
      <div className="venue-sheet w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Close">
          <X size={18} />
        </button>
        <div className="px-5 pb-6 pt-1">
          <h3 className="mb-1">Create a free account</h3>
          <p className="text-[14px] text-[var(--text-secondary)] mb-5">{reason}</p>
          <div className="flex flex-col gap-2">
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn btn-primary w-full">
              Sign up
            </Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-secondary w-full">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
