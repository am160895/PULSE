/** Thin restrained progress bar for level/neighborhood progression — deliberately not a
 * video-game XP bar (spec §6: "premium restrained design"). */
export function ProgressBar({ current, target, label }: { current: number; target: number | null; label?: string }) {
  const pct = target ? Math.min(100, Math.max(0, (current / target) * 100)) : 100;
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <span>{label}</span>
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {target ? `${current} / ${target} XP` : `${current} XP`}
          </span>
        </div>
      )}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
