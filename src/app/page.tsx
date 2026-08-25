import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Radio, TrendingUp, Users } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session) redirect("/map");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--hot)" }}>
            <Radio size={15} color="white" />
          </span>
          PULSE
        </div>
        <Link href="/login" className="btn btn-ghost btn-sm">
          Log in
        </Link>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-5xl w-full mx-auto px-6 py-16 grid gap-14 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="mb-5">
              Know where the night
              <br />
              is happening.
            </h1>
            <p className="text-[17px] text-[var(--text-secondary)] mb-8 max-w-md">
              PULSE analyzes live reports, historical patterns, and events to show which
              venues are busy, rising, quiet, or worth the trip — right now, not last
              Tuesday.
            </p>
            <div className="flex gap-3 mb-12">
              <Link href="/signup" className="btn btn-primary">
                Explore NYC <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Log in
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Benefit icon={<Radio size={18} />} title="See what's live" body="A real-time score with the reasons behind it, not a static rating." />
              <Benefit icon={<TrendingUp size={18} />} title="Know before you go" body="Rising, falling, or about to peak — and roughly when." />
              <Benefit icon={<Users size={18} />} title="Find your people" body="See when friends are out, on your terms, never by default." />
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-strong)]">
            <MapPreview />
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-[var(--text-muted)] py-8">
        PULSE · Manhattan launch · West Village, SoHo, LES, East Village, Chelsea, Meatpacking, Nolita, NoHo, Greenwich Village
      </footer>
    </div>
  );
}

function Benefit({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">
        {icon}
      </div>
      <h3 className="mb-1">{title}</h3>
      <p className="text-[13px] text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function MapPreview() {
  const dots = [
    { x: "22%", y: "30%", score: 94, cls: "hot" },
    { x: "58%", y: "20%", score: 81, cls: "rising" },
    { x: "40%", y: "55%", score: 72, cls: "active" },
    { x: "72%", y: "62%", score: 45, cls: "moderate" },
    { x: "15%", y: "70%", score: 28, cls: "quiet" },
    { x: "85%", y: "38%", score: 88, cls: "hot" },
  ];
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-md)]" style={{ background: "#0e1116" }}>
      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 18} x2="100" y2={i * 18} stroke="var(--border)" strokeWidth="0.3" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 18} y1="0" x2={i * 18} y2="100" stroke="var(--border)" strokeWidth="0.3" />
        ))}
      </svg>
      {dots.map((d, i) => (
        <div key={i} className="absolute" style={{ left: d.x, top: d.y, transform: "translate(-50%, -50%)" }}>
          {d.cls === "hot" && <div className="pulse-ring" />}
          <div className={`venue-marker ${d.cls}`} style={{ width: 40, height: 40, fontSize: 12 }}>
            {d.score}
          </div>
        </div>
      ))}
    </div>
  );
}
