"use client";

import Link from "next/link";
import { useSavedVenues } from "@/hooks/api";
import { PulseLabelBadge, TrendIndicator, WaitBadge } from "@/components/venues/Badges";
import { EmptyState, LoadingDots } from "@/components/ui/States";
import { VENUE_TYPE_LABELS } from "@/config/constants";

export default function SavedPage() {
  const { data: venues, isLoading } = useSavedVenues();

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-1">Saved</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">Venues you&apos;re keeping an eye on.</p>

      {isLoading && <LoadingDots />}

      {venues && venues.length === 0 && (
        <EmptyState
          title="No saved venues yet"
          body="Tap the bookmark icon on a venue to save it here."
          action={
            <Link href="/map" className="btn btn-primary">
              Browse the map
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {venues?.map((v) => (
          <Link key={v.id} href={`/venue/${v.id}`} className="venue-card !min-w-0 flex items-center justify-between">
            <div>
              <p className="font-semibold text-[14px] mb-0.5">{v.name}</p>
              <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">
                {v.neighborhood} · {VENUE_TYPE_LABELS[v.venueType]}
              </p>
              <div className="flex items-center gap-3">
                <PulseLabelBadge label={v.pulse.pulseLabel} />
                <TrendIndicator trend={v.pulse.trend} delta={v.pulse.trendDeltaLast30Min} />
              </div>
            </div>
            <div className="text-right">
              <div className="pulse-score-number" style={{ fontSize: 24 }}>
                {v.pulse.pulseScore}
              </div>
              <WaitBadge estimate={v.pulse.waitEstimate} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
