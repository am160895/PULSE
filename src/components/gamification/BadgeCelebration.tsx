"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";
import { BadgeMedallion } from "./BadgeMedallion";

export interface BadgeCelebrationProps {
  badge: { name: string; description: string; motif: string };
  xpEarned?: number;
  onClose: () => void;
}

const PARTICLE_OFFSETS = [
  { x: -46, y: -58 },
  { x: 10, y: -70 },
  { x: 52, y: -40 },
  { x: -60, y: -18 },
  { x: 60, y: -10 },
  { x: -20, y: -76 },
];

/**
 * A badge unlock deserves stronger visual feedback than a regular contribution toast
 * (spec §9) — this is the one place a small celebratory particle effect is acceptable,
 * still restrained (six dots, not confetti).
 */
export function BadgeCelebration({ badge, xpEarned, onClose }: BadgeCelebrationProps) {
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  async function handleShare() {
    const text = `I just earned "${badge.name}" on PULSE — ${badge.description}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: badge.name, text });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setShareLabel("Copied");
    setTimeout(() => setShareLabel(null), 2000);
  }

  return (
    <div className="badge-celebration-backdrop" onClick={onClose}>
      <div className="badge-celebration-card" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute" style={{ top: 14, right: 14, color: "var(--text-muted)" }} aria-label="Close">
          <X size={18} />
        </button>

        <div className="relative mx-auto mb-4" style={{ width: 72, height: 72 }}>
          {PARTICLE_OFFSETS.map((p, i) => (
            <span
              key={i}
              className="celebration-particle"
              style={{
                left: "50%",
                top: "50%",
                animationDelay: `${i * 40}ms`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--particle-x" as any]: `${p.x}px`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--particle-y" as any]: `${p.y}px`,
              }}
            />
          ))}
          <BadgeMedallion motif={badge.motif} size={72} />
        </div>

        <p className="mb-1" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>
          Badge unlocked
        </p>
        <h2 className="mb-2">{badge.name}</h2>
        <p className="mb-4" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {badge.description}
        </p>
        {typeof xpEarned === "number" && xpEarned > 0 && (
          <p className="mb-5 font-semibold" style={{ fontSize: 13, color: "var(--active)" }}>
            +{xpEarned} XP
          </p>
        )}

        <button className="btn btn-secondary w-full" onClick={handleShare}>
          <Share2 size={15} /> {shareLabel ?? "Share"}
        </button>
      </div>
    </div>
  );
}
