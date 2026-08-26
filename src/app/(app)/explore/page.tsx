"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExplore } from "@/hooks/api";
import { PulseLabelBadge, TrendIndicator, WaitBadge } from "@/components/venues/Badges";
import { LoadingDots, EmptyState } from "@/components/ui/States";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { getUserLocationOnce } from "@/lib/geo/userLocation";

export default function ExplorePage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { data: sections, isLoading, isError, refetch } = useExplore(userLocation);

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
    <div className="max-w-3xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-1">Explore</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">Different lenses on what&apos;s happening right now.</p>

      {isLoading && <LoadingDots />}

      {isError && (
        <EmptyState
          title="Couldn't load Explore"
          body="Something went wrong reaching PULSE. Check your connection and try again."
          action={
            <button className="btn btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          }
        />
      )}

      {sections && sections.length === 0 && (
        <EmptyState
          title="Nothing to show yet"
          body="Venues need either live reports or a bit more time tonight before they show up here."
        />
      )}

      <div className="flex flex-col gap-7">
        {sections?.map((section) => (
          <section key={section.key}>
            <h2 className="mb-3" style={{ fontSize: 17 }}>
              {section.title}
            </h2>
            <div className="scroll-x">
              {section.venues.map((v) => (
                <Link key={v.id} href={`/venue/${v.id}`} className="venue-card shrink-0" style={{ scrollSnapAlign: "start" }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-[14px] mb-0.5">{v.name}</p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        {v.neighborhood} · {VENUE_TYPE_LABELS[v.venueType]}
                      </p>
                    </div>
                    <div className="pulse-score-number" style={{ fontSize: 24 }}>
                      {v.pulse.pulseScore}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <PulseLabelBadge label={v.pulse.pulseLabel} />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <TrendIndicator trend={v.pulse.trend} delta={v.pulse.trendDeltaLast30Min} />
                    <WaitBadge estimate={v.pulse.waitEstimate} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
