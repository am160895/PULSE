"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { VenueWithPulse } from "@/types";
import { useDecide } from "@/hooks/api";
import { MoveBadge, TrendIndicator, WaitBadge } from "@/components/venues/Badges";
import { LoadingDots, EmptyState } from "@/components/ui/States";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { getUserLocationOnce } from "@/lib/geo/userLocation";
import { formatDistance } from "@/lib/geo";

export default function DecidePage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { data, isLoading, isError, refetch } = useDecide(userLocation);

  useEffect(() => {
    let cancelled = false;
    getUserLocationOnce().then((loc) => {
      if (loc && !cancelled) setUserLocation(loc);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <Link href="/map" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] mb-4">
        <ArrowLeft size={14} /> Map
      </Link>

      <h1 className="mb-1">Where should we go?</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">One best move, right now — not a list to scroll through.</p>

      {isLoading && <LoadingDots />}

      {isError && (
        <EmptyState
          title="Couldn't decide"
          body="Something went wrong reaching PULSE. Check your connection and try again."
          action={
            <button className="btn btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          }
        />
      )}

      {data && !data.bestMove && (
        <EmptyState
          title="Nothing's a good move right now"
          body="Nowhere nearby is clearing the bar tonight — check the map, or try again in a bit."
        />
      )}

      {data?.bestMove && (
        <div className="flex flex-col gap-5">
          <DecisionCard label="Best move" venue={data.bestMove} highlight />
          {data.moreEnergy && <DecisionCard label="If you want more energy" venue={data.moreEnergy} />}
          {data.lessWait && <DecisionCard label="If you want less wait" venue={data.lessWait} />}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ label, venue, highlight }: { label: string; venue: VenueWithPulse; highlight?: boolean }) {
  return (
    <section>
      <p
        className="mb-2 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: highlight ? "var(--accent)" : "var(--text-secondary)" }}
      >
        {label}
      </p>
      <Link href={`/venue/${venue.id}`} className="venue-card block" style={highlight ? { borderColor: "var(--accent)" } : undefined}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-[16px] mb-0.5 truncate">{venue.name}</p>
            <p className="text-[12px] text-[var(--text-secondary)] truncate">
              {venue.neighborhood} · {VENUE_TYPE_LABELS[venue.venueType]}
              {venue.distanceMeters !== undefined ? ` · ${formatDistance(venue.distanceMeters)}` : ""}
            </p>
          </div>
          <div className="pulse-score-number shrink-0" style={{ fontSize: 26 }}>
            {venue.pulse.pulseScore}
          </div>
        </div>
        {venue.move && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <MoveBadge move={venue.move} />
          </div>
        )}
        <div className="flex items-center justify-between text-[12px]">
          <TrendIndicator trend={venue.pulse.trend} delta={venue.pulse.trendDeltaLast30Min} />
          <WaitBadge estimate={venue.pulse.waitEstimate} />
        </div>
        <div className="btn btn-primary mt-3 w-full text-center">Go →</div>
      </Link>
    </section>
  );
}
