"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Info, MapPin, Music, Share2, Users } from "lucide-react";
import { useInvalidateVenue, useVenue, useVenueHistory } from "@/hooks/api";
import { ConfidenceBadge, FreshnessBadge, OpenStateBadge, PulseLabelBadge, PulseScoreDisplay, TrendIndicator, WaitBadge } from "@/components/venues/Badges";
import { ActivityGraph } from "@/components/venues/ActivityGraph";
import { ReportSheet } from "@/components/venues/ReportSheet";
import { EmptyState, LoadingDots } from "@/components/ui/States";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { requestJson } from "@/lib/http/requestJson";
import { format, parseISO } from "date-fns";

export default function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useVenue(id);
  const { data: history } = useVenueHistory(id);
  const invalidate = useInvalidateVenue();
  const [showReport, setShowReport] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <BackLink />
        <EmptyState
          title="Couldn't load this venue"
          body="Something went wrong reaching PULSE. Check your connection and try again."
          action={
            <button className="btn btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <BackLink />
        <LoadingDots />
      </div>
    );
  }

  const { venue, alternatives } = data;
  const { pulse } = venue;
  const isDirectory = venue.coverageState === "DIRECTORY";
  // "Better move" only earns its place when THIS venue actually has a problem (a real
  // queue, or momentum heading the wrong way) — not just because some other venue exists.
  // A thriving, rising venue doesn't need to suggest people leave (§14).
  const hasProblem =
    (pulse.waitEstimate && pulse.waitEstimate.minMinutes >= 15) ||
    pulse.trend === "FALLING" ||
    pulse.trend === "FALLING_FAST";
  const showBetterMove = !isDirectory && hasProblem && alternatives.length > 0;

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        const text = isDirectory ? `Check out ${venue.name} on PULSE` : `${venue.name} is ${pulse.pulseScore} on PULSE right now`;
        await navigator.share({ title: venue.name, text, url });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setShareMessage("Link copied");
    setTimeout(() => setShareMessage(null), 2000);
  }

  async function handleToggleSaved() {
    const result = await requestJson(`/api/venues/${venue.id}/saved`, { method: "POST" });
    if (result.ok) invalidate(venue.id);
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <BackLink />

      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="mb-1">{venue.name}</h1>
          <p className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1">
            <MapPin size={13} /> {venue.neighborhood} · {VENUE_TYPE_LABELS[venue.venueType]}
            {venue.musicType ? (
              <>
                {" "}
                · <Music size={13} className="inline" /> {venue.musicType}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {isDirectory ? (
        <div className="mb-4 py-3 border-y border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <OpenStateBadge state={venue.openState} />
            <span className="badge badge-low">No live PULSE yet</span>
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">
            This is a real, known venue — nobody&apos;s reported here yet. Be the first to say how it is tonight.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mt-4 mb-2">
            <PulseScoreDisplay score={pulse.pulseScore} label={pulse.pulseLabel} />
            <div className="flex flex-col gap-1.5">
              <PulseLabelBadge label={pulse.pulseLabel} />
              <ConfidenceBadge label={pulse.confidenceLabel} />
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 text-sm border-y border-[var(--border)] py-3 flex-wrap gap-2">
            <TrendIndicator trend={pulse.trend} delta={pulse.trendDeltaLast30Min} />
            <OpenStateBadge state={venue.openState} />
            <FreshnessBadge label={pulse.freshness} />
            <WaitBadge estimate={pulse.waitEstimate} />
          </div>

          <section className="mb-5">
            <SectionTitle icon={<Info size={14} />} title="Why now" />
            <p className="text-[14px] text-[var(--text-secondary)] mb-2">{pulse.explanation}</p>
            {pulse.expectedPeak && (
              <p className="text-[13px] text-[var(--text-muted)]">
                Expected peak: {format(parseISO(pulse.expectedPeak.start), "h:mm a")}–{format(parseISO(pulse.expectedPeak.end), "h:mm a")}
              </p>
            )}
            <details className="mt-2">
              <summary className="text-[12px] text-[var(--text-muted)] cursor-pointer">What&apos;s this based on</summary>
              <ul className="mt-2 text-[13px] text-[var(--text-secondary)] flex flex-col gap-1">
                {pulse.components.map((c) => (
                  <li key={c.key} className="flex justify-between">
                    <span>{c.label}</span>
                    <span className="font-medium text-[var(--text)]">{c.value}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          {history && (
            <section className="mb-5">
              <SectionTitle title="Activity" />
              <ActivityGraph past={history.past} forecast={history.forecast} />
            </section>
          )}
        </>
      )}

      {venue.friendsPresent && venue.friendsPresent.length > 0 && (
        <section className="mb-5">
          <SectionTitle icon={<Users size={14} />} title="Friends" />
          <div className="flex flex-col gap-2">
            {venue.friendsPresent.map((f) => (
              <div key={f.profileId} className="flex items-center justify-between text-[14px]">
                <span>{f.displayName}</span>
                <span className="text-[var(--text-muted)]">{presenceStatusText(f.status)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-3 gap-2 mb-6">
        <button className="btn btn-primary col-span-1" onClick={() => setShowReport(true)}>
          I&apos;m here
        </button>
        <button className="btn btn-secondary" onClick={handleShare}>
          <Share2 size={15} /> {shareMessage ?? "Share"}
        </button>
        <button className="btn btn-secondary" onClick={handleToggleSaved}>
          <Bookmark size={15} fill={venue.isSaved ? "currentColor" : "none"} /> {venue.isSaved ? "Saved" : "Save"}
        </button>
      </div>

      {showBetterMove && (
        <section className="mb-6">
          <SectionTitle title="Better move" />
          <div className="flex flex-col gap-2">
            {alternatives.map((alt) => (
              <Link
                key={alt.id}
                href={`/venue/${alt.id}`}
                className="venue-card flex items-center justify-between !min-w-0"
              >
                <div>
                  <p className="font-medium text-[14px]">{alt.name}</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {alt.distanceMeters ? `${Math.round(alt.distanceMeters)}m away` : alt.neighborhood} ·{" "}
                    <TrendIndicator trend={alt.pulse.trend} delta={alt.pulse.trendDeltaLast30Min} />
                  </p>
                </div>
                <div className="pulse-score-number" style={{ fontSize: 22 }}>
                  {alt.pulse.pulseScore}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="text-[13px] text-[var(--text-secondary)] flex flex-col gap-1">
        <p>{venue.streetAddress}, {venue.city}</p>
        <p>Capacity ~{venue.capacityEstimate ?? "unknown"}</p>
      </section>

      {showReport && (
        <ReportSheet
          venueId={venue.id}
          onClose={() => setShowReport(false)}
          onSubmitted={() => {
            setShowReport(false);
            invalidate(venue.id);
          }}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/map" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] mb-4">
      <ArrowLeft size={14} /> Map
    </Link>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[var(--text-secondary)]" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
      {icon}
      {title}
    </h3>
  );
}

function presenceStatusText(status: string): string {
  switch (status) {
    case "AT_VENUE":
      return "Here now";
    case "HEADING_THERE":
      return "On the way";
    case "NEARBY":
      return "Nearby";
    default:
      return "Recently here";
  }
}
