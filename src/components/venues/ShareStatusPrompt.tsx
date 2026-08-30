"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";

interface Props {
  onClose: () => void;
  /** Fired only once a share/copy actually completes — not on open, not on cancel. */
  onShared: () => void;
  /** The exact text (see buildShareStatusText) that'll be shared/copied — shown as a
   * preview so sharing doesn't feel like a black box. */
  shareText: string;
  url: string;
  venueName: string;
}

/**
 * The post-contribution "sharing loop" prompt (growth spec) — offered once after a
 * successful I'm Here or report, never blocking the contribution's own success toast/badge
 * celebration. Skippable, and never re-shown for the same contribution if dismissed.
 */
export function ShareStatusPrompt({ onClose, onShared, shareText, url, venueName }: Props) {
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: venueName, text: shareText, url });
        onShared();
        onClose();
        return;
      } catch {
        // user cancelled — leave the prompt open, fall through to clipboard on next click
      }
    }
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    onShared();
    setShareLabel("Copied");
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 pb-16" onClick={onClose}>
      <div className="venue-sheet w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Close">
          <X size={18} />
        </button>
        <div className="px-5 pb-6 pt-1">
          <h3 className="mb-1">Share live status</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mb-3">Let people know what&apos;s happening right now.</p>
          <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] mb-4">
            {shareText}
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={handleShare} className="btn btn-primary w-full">
              <Share2 size={15} /> {shareLabel ?? "Share live status"}
            </button>
            <button onClick={onClose} className="btn btn-ghost w-full">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
