"use client";

import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import type { VenueWithPulse } from "@/types";
import { OpenStateBadge, PulseLabelBadge, ConfidenceBadge, TrendIndicator, WaitBadge } from "@/components/venues/Badges";
import { VsTypicalBadge } from "@/components/venues/VsTypicalBadge";
import { formatDistance } from "@/lib/geo";
import { VENUE_TYPE_LABELS } from "@/config/constants";

interface Props {
  venue: VenueWithPulse;
  onClose: () => void;
  onToggleSaved: (venueId: string) => void;
}

export function VenueBottomSheet({ venue, onClose, onToggleSaved }: Props) {
  const isDirectory = venue.coverageState === "DIRECTORY";
  const isClosed = venue.currentPulseStatus === "CLOSED";
  const showScore = !isDirectory && !isClosed;

  return (
    <div className="fixed left-0 right-0 bottom-16 z-40 px-2 pb-2">
      <div className="venue-sheet mx-auto max-w-xl">
        <div className="sheet-handle" />
        <button onClick={onClose} className="absolute top-3 right-3 text-[var(--text-muted)]" aria-label="Close">
          <X size={18} />
        </button>
        <div className="px-5 pb-5 pt-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="mb-0.5">{venue.name}</h3>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {venue.neighborhood} · {VENUE_TYPE_LABELS[venue.venueType]}
                {venue.distanceMeters !== undefined ? ` · ${formatDistance(venue.distanceMeters)}` : ""}
              </p>
            </div>
            {showScore && (
              <div className="text-right shrink-0">
                <div className="pulse-score-number" style={{ fontSize: 30 }}>
                  {venue.pulse.pulseScore}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <OpenStateBadge state={venue.openState} />
            {isDirectory ? (
              <span className="badge badge-low">No live PULSE yet</span>
            ) : isClosed ? (
              <span className="badge badge-low">{venue.openStatus.displayText}</span>
            ) : (
              <>
                <PulseLabelBadge label={venue.pulse.pulseLabel} />
                <ConfidenceBadge label={venue.pulse.confidenceLabel} />
                {venue.vsTypical && <VsTypicalBadge comparison={venue.vsTypical} />}
              </>
            )}
          </div>

          {isDirectory ? (
            <p className="text-[13px] text-[var(--text-secondary)] mt-3">
              Nobody&apos;s reported here yet — be the first to say how it is tonight.
            </p>
          ) : isClosed ? null : (
            <div className="flex items-center justify-between mt-3 text-sm">
              <TrendIndicator trend={venue.pulse.trend} delta={venue.pulse.trendDeltaLast30Min} />
              <WaitBadge estimate={venue.pulse.waitEstimate} />
            </div>
          )}

          {venue.friendsPresent && venue.friendsPresent.length > 0 && (
            <p className="text-[13px] mt-2" style={{ color: "var(--accent)" }}>
              {venue.friendsPresent.length} friend{venue.friendsPresent.length > 1 ? "s" : ""} here
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <Link href={`/venue/${venue.id}`} className="btn btn-primary flex-1">
              {isDirectory ? "I'm here" : "View details"}
            </Link>
            <button
              onClick={() => onToggleSaved(venue.id)}
              className="btn btn-secondary"
              aria-label={venue.isSaved ? "Unsave" : "Save"}
            >
              <Bookmark size={16} fill={venue.isSaved ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
