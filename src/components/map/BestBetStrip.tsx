"use client";

import Link from "next/link";
import { useExplore } from "@/hooks/api";

interface Props {
  userLocation: { lat: number; lng: number } | null;
}

/** A compact glanceable rail on the map (the app's actual home screen) surfacing the
 * top few Best Bet picks — reuses the same /api/explore data the Explore tab already
 * fetches (lib/pulse/explore.ts's isBestBetVenue), no new endpoint or round trip. Sits
 * above the bottom nav, in the same slot VenueBottomSheet uses once something is
 * selected — the map page only renders one or the other, never both, so there's no
 * layout collision to reason about. */
export function BestBetStrip({ userLocation }: Props) {
  const { data: sections } = useExplore(userLocation);
  const bestBet = sections?.find((s) => s.key === "bestBet");
  if (!bestBet || bestBet.venues.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 z-30 pb-2" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
      <p className="mb-1.5 px-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
        Best bet tonight
      </p>
      <div className="scroll-x px-3">
        {bestBet.venues.slice(0, 4).map((v) => (
          <Link key={v.id} href={`/venue/${v.id}`} className="venue-card shrink-0" style={{ minWidth: 180, scrollSnapAlign: "start" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[13px] truncate">{v.name}</p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{v.neighborhood}</p>
              </div>
              <div className="pulse-score-number shrink-0" style={{ fontSize: 20 }}>
                {v.pulse.pulseScore}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
