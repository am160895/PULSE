export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <h3 className="mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--text-secondary)] max-w-xs mb-4">{body}</p>
      {action}
    </div>
  );
}

export function LoadingDots() {
  return (
    <div className="flex items-center justify-center py-16 gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--text-muted)", animation: `pulse-ring 1.2s ${i * 0.15}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return <div className="h-14 rounded-[var(--radius-sm)] mb-2" style={{ background: "var(--surface-2)" }} />;
}
