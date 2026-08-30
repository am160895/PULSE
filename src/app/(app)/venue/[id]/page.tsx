"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Clock, Info, MapPin, Music, Navigation, Share2, Users } from "lucide-react";
import { useInvalidateVenue, useVenue, useVenueHistory } from "@/hooks/api";
import {
  ClosedVenueStatus,
  FreshnessBadge,
  MoveBadge,
  OpenStateBadge,
  PulseLabelBadge,
  PulseScoreDisplay,
  TrendIndicator,
  WaitBadge,
} from "@/components/venues/Badges";
import { VsTypicalBadge } from "@/components/venues/VsTypicalBadge";
import { ActivityGraph } from "@/components/venues/ActivityGraph";
import { ReportSheet, type ReportSubmitResult } from "@/components/venues/ReportSheet";
import { QuickPulseCheck } from "@/components/venues/QuickPulseCheck";
import { HoursWeekList } from "@/components/venues/HoursWeekList";
import { ContributionSuccess, type ContributionSuccessProps } from "@/components/gamification/ContributionSuccess";
import { BadgeCelebration } from "@/components/gamification/BadgeCelebration";
import { ShareStatusPrompt } from "@/components/venues/ShareStatusPrompt";
import { BADGE_CATALOG } from "@/lib/gamification/badgeCatalog";
import { EmptyState, LoadingDots } from "@/components/ui/States";
import { SignUpPrompt } from "@/components/ui/SignUpPrompt";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { requestJson } from "@/lib/http/requestJson";
import { buildShareStatusText } from "@/lib/share/shareText";
import { trackEvent } from "@/lib/analytics/track";
import { format, parseISO } from "date-fns";
import type { BadgeCode, ContributorLevel } from "@/types";

interface XpResult {
  awarded?: boolean;
  xpAmount: number;
  totalXp: number;
  level: ContributorLevel;
  leveledUp: boolean;
}

interface BadgeUnlock {
  code: BadgeCode;
  neighborhood: string;
  xpEventId: string | null;
}

/** The write action an anonymous session was trying to do when it hit SignUpPrompt —
 * carried through signup/login's `next` redirect as `?intent=` so the venue page can
 * resume it automatically instead of just landing the user back on a blank page (growth
 * spec: "return to exact prior context after authenticating"). */
type WriteIntent = "im-here" | "report" | "save" | "claim";

function progressFromXp(xp: XpResult) {
  return {
    label: xp.level.label,
    current: xp.totalXp - xp.level.minXp,
    target: xp.level.nextLevelXp ? xp.level.nextLevelXp - xp.level.minXp : null,
  };
}

export default function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useVenue(id);
  const { data: history } = useVenueHistory(id);
  const invalidate = useInvalidateVenue();
  const [showReport, setShowReport] = useState(false);
  const [showQuickCheck, setShowQuickCheck] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [imHereSubmitting, setImHereSubmitting] = useState(false);
  const [imHereError, setImHereError] = useState<string | null>(null);
  const [toast, setToast] = useState<(ContributionSuccessProps & { key: string }) | null>(null);
  const [celebratingBadge, setCelebratingBadge] = useState<{ name: string; description: string; motif: string } | null>(null);
  const badgeQueueRef = useRef<BadgeCode[]>([]);
  const [lastOwnReportId, setLastOwnReportId] = useState<string | null>(null);
  const shownConfirmationsRef = useRef<Set<string>>(new Set());
  const [claiming, setClaiming] = useState(false);
  const [signUpPrompt, setSignUpPrompt] = useState<{ reason: string; intent: WriteIntent } | null>(null);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const pendingShareRef = useRef(false);
  const router = useRouter();
  const resumedIntentRef = useRef(false);

  function celebrateNextBadge() {
    const next = badgeQueueRef.current.shift();
    if (next) {
      const def = BADGE_CATALOG[next];
      setCelebratingBadge({ name: def.name, description: def.description, motif: def.motif });
    } else if (pendingShareRef.current) {
      // Only offer the share prompt once every unlocked-badge celebration has been seen —
      // stacking it under BadgeCelebration's full-screen backdrop would hide it entirely.
      pendingShareRef.current = false;
      setShowSharePrompt(true);
    }
  }

  function queueBadgeCelebrations(unlocks: BadgeUnlock[]) {
    if (unlocks.length === 0) return;
    badgeQueueRef.current.push(...unlocks.map((u) => u.code));
    if (!celebratingBadge) celebrateNextBadge();
  }

  /** Sharing-loop growth spec: offer "Share live status" after a successful I'm Here or
   * report, deferred until any badge celebration for that same action has been dismissed. */
  function offerShareAfter(unlocks: BadgeUnlock[]) {
    if (unlocks.length > 0) pendingShareRef.current = true;
    else setShowSharePrompt(true);
  }

  // Delayed accuracy confirmations (spec §5) surface here — useVenue's own 20s poll is
  // the "later" moment that resolves them, no separate polling needed. A confirmation can
  // also unlock TREND_SPOTTER/EARLY_SIGNAL, which structurally can only ever unlock this
  // way (see composeVenue.ts) — queue those the same as any other badge unlock.
  useEffect(() => {
    if (!data?.newlyConfirmedSignals?.length) return;
    for (const signal of data.newlyConfirmedSignals) {
      if (shownConfirmationsRef.current.has(signal.reportId)) continue;
      shownConfirmationsRef.current.add(signal.reportId);
      setToast({
        key: `confirmed-${signal.reportId}`,
        title: "Accurate signal",
        message: "Your earlier report was confirmed by the crowd.",
        xpEarned: signal.xpAwarded,
        onDismiss: () => setToast(null),
      });
    }
    if (data.newlyUnlockedBadges?.length) queueBadgeCelebrations(data.newlyUnlockedBadges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.newlyConfirmedSignals]);

  // Growth-funnel analytics (acquisition spec) plus resuming a write action that got
  // interrupted by SignUpPrompt before authenticating — reading window.location.search
  // directly rather than useSearchParams() avoids needing a Suspense boundary around this
  // page just for two optional query params.
  useEffect(() => {
    if (!data?.venue.id) return;
    trackEvent("VENUE_VIEW", data.venue.id);
    const params = new URLSearchParams(window.location.search);
    if (params.get("src") === "share") trackEvent("SHARED_LINK_OPENED", data.venue.id);

    const intent = params.get("intent") as WriteIntent | null;
    if (intent && !resumedIntentRef.current) {
      resumedIntentRef.current = true;
      if (intent === "im-here") void handleImHere();
      // A deliberate one-time imperative action resuming an interrupted intent on mount,
      // not state derived from a prop/subscription — the usual "don't setState in an
      // effect" rationale doesn't apply here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else if (intent === "report") setShowReport(true);
      else if (intent === "save") void handleToggleSaved();
      else if (intent === "claim") void handleClaim();

      // Strip it so a refresh or the browser back button doesn't repeat the action.
      params.delete("intent");
      const qs = params.toString();
      router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.venue.id]);

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

  const { venue, alternatives, myOwnershipStatus } = data;
  const { pulse } = venue;
  const isDirectory = venue.coverageState === "DIRECTORY";
  const isClosed = venue.currentPulseStatus === "CLOSED";
  // "Better move" only earns its place when THIS venue actually has a problem (a real
  // queue, or momentum heading the wrong way) — not just because some other venue exists.
  // A thriving, rising venue doesn't need to suggest people leave (§14).
  const hasProblem =
    (pulse.waitEstimate && pulse.waitEstimate.minMinutes >= 15) ||
    pulse.trend === "FALLING" ||
    pulse.trend === "FALLING_FAST";
  const showBetterMove = !isDirectory && !isClosed && hasProblem && alternatives.length > 0;

  function currentShareText() {
    return buildShareStatusText({
      venueName: venue.name,
      isDirectory,
      isClosed,
      pulseScore: pulse.pulseScore,
      pulseLabel: pulse.pulseLabel,
      openStatusText: venue.openStatus.displayText,
      trend: pulse.trend,
      waitEstimate: pulse.waitEstimate,
    });
  }

  // ?src=share marks the link as opened-from-a-share on the receiving end (see the
  // SHARED_LINK_OPENED effect above) — a real, deep-linkable venue URL, viewable without
  // an account, matching the growth spec's sharing-loop requirement.
  function shareableUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("src", "share");
    return url.toString();
  }

  async function handleShare() {
    const url = shareableUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: venue.name, text: currentShareText(), url });
        trackEvent("VENUE_SHARED", venue.id);
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    trackEvent("VENUE_SHARED", venue.id);
    setShareMessage("Link copied");
    setTimeout(() => setShareMessage(null), 2000);
  }

  async function handleToggleSaved() {
    const result = await requestJson<{ isSaved: boolean }>(`/api/venues/${venue.id}/saved`, { method: "POST" });
    if (result.ok) {
      invalidate(venue.id);
      if (result.data.isSaved) trackEvent("VENUE_SAVED", venue.id);
    } else if (result.code === "ANONYMOUS_SESSION") {
      setSignUpPrompt({ reason: "Create a free account to save venues.", intent: "save" });
    }
  }

  function handleDirections() {
    trackEvent("DIRECTIONS_CLICKED", venue.id);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleImHere() {
    setImHereSubmitting(true);
    setImHereError(null);
    const result = await requestJson<{ xp: XpResult | null; badgesUnlocked: BadgeUnlock[] }>("/api/presence", {
      method: "POST",
      body: { venueId: venue.id, status: "AT_VENUE", visibility: "FRIENDS" },
    });
    setImHereSubmitting(false);

    if (!result.ok) {
      if (result.code === "ANONYMOUS_SESSION") {
        setSignUpPrompt({ reason: "Create a free account to share when you're here.", intent: "im-here" });
      } else {
        setImHereError(result.error);
      }
      return;
    }

    const xp = result.data.xp;
    setToast({
      key: `im-here-${Date.now()}`,
      title: "You're on the Pulse",
      message: "Presence shared with friends · expires automatically",
      xpEarned: xp?.awarded ? xp.xpAmount : undefined,
      progressUpdate: xp ? progressFromXp(xp) : null,
      onDismiss: () => setToast(null),
    });
    invalidate(venue.id);
    trackEvent("IM_HERE_COMPLETED", venue.id);
    if (result.data.badgesUnlocked.length > 0) queueBadgeCelebrations(result.data.badgesUnlocked);
    // Immediately follow up with a fast, skippable 3-tap check — I'm Here already earned
    // its own XP above; answering these earns meaningfully more on top, through the same
    // report pipeline as the full Report sheet. The share offer waits for that flow to
    // conclude (submitted or skipped) rather than firing here too — see its own call
    // sites below — so it never stacks under the quick-check sheet.
    setShowQuickCheck(true);
  }

  // Shared by both the full Report sheet and the post-I'm-Here quick check — same
  // response shape either way (both submit through /api/venues/[id]/reports), so the
  // XP/badge/impact feedback is identical regardless of which flow produced it.
  function handleReportSubmitted(result: ReportSubmitResult) {
    invalidate(venue.id);
    trackEvent("REPORT_COMPLETED", venue.id);
    setLastOwnReportId(result.reportId);

    setToast({
      key: `report-${result.reportId}`,
      title: result.impactMessage.title,
      message: result.impactMessage.detail,
      xpEarned: result.xp.totalXpAwarded > 0 ? result.xp.totalXpAwarded : undefined,
      progressUpdate: progressFromXp({ ...result.xp, xpAmount: result.xp.totalXpAwarded }),
      onDismiss: () => setToast(null),
    });
    if (result.badgesUnlocked.length > 0) queueBadgeCelebrations(result.badgesUnlocked);
    offerShareAfter(result.badgesUnlocked);
  }

  async function handleClaim() {
    setClaiming(true);
    const result = await requestJson<{ status: string }>(`/api/venues/${venue.id}/claim`, { method: "POST" });
    setClaiming(false);
    if (result.ok) {
      refetch();
    } else if (result.code === "ANONYMOUS_SESSION") {
      setSignUpPrompt({ reason: "Create a free account to claim this venue.", intent: "claim" });
    }
  }

  async function handleSimulateConfirmation() {
    if (!lastOwnReportId) return;
    await requestJson("/api/dev/simulate-confirmation", { method: "POST", body: { reportId: lastOwnReportId } });
    setTimeout(() => refetch(), 300);
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

      <p className="text-[13px] font-medium mb-2" style={{ color: isClosed ? "var(--text-secondary)" : "var(--active)" }}>
        {venue.openStatus.displayText}
      </p>

      {isDirectory ? (
        <div className="mb-4 py-3 border-y border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <OpenStateBadge state={venue.openState} />
            <span className="badge badge-low">No live PULSE yet</span>
            {venue.move && <MoveBadge move={venue.move} />}
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">
            This is a real, known venue — nobody&apos;s reported here yet. Be the first to say how it is tonight.
          </p>
        </div>
      ) : isClosed ? (
        <ClosedVenueStatus openStatus={venue.openStatus} expectedPeak={pulse.expectedPeak} timeZone={venue.timezone} />
      ) : (
        <>
          <div className="flex items-center gap-4 mt-4 mb-2">
            <PulseScoreDisplay score={pulse.pulseScore} label={pulse.pulseLabel} />
            <div className="flex flex-col gap-1.5">
              <PulseLabelBadge label={pulse.pulseLabel} />
              {venue.move && <MoveBadge move={venue.move} />}
              {venue.vsTypical && <VsTypicalBadge comparison={venue.vsTypical} />}
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
        </>
      )}

      {/* Typical is a pure historical-baseline curve, computed independent of whether this
          venue has any live pulse right now — shown for every venue regardless of
          open/closed/directory state, not just the ones with an active score above. */}
      {history && (
        <section className="mb-5">
          <SectionTitle title="Activity" />
          <ActivityGraph past={history.past} forecast={history.forecast} />
        </section>
      )}

      {/* Always visible, never gated behind a tap — every venue's hours must be legible
          straight off the page, regardless of open/closed/directory state. */}
      <section className="mb-5">
        <SectionTitle icon={<Clock size={14} />} title="Hours" />
        <HoursWeekList hours={venue.hours} timeZone={venue.timezone} />
      </section>

      {venue.hoursDiscrepancy && (
        <p className="mb-4 text-[12.5px]" style={{ color: "var(--rising)" }}>
          Possible hours discrepancy — recent verified activity at a venue marked closed.
        </p>
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

      <div className="grid grid-cols-3 gap-2 mb-2">
        <button className="btn btn-primary col-span-1" onClick={handleImHere} disabled={imHereSubmitting}>
          {imHereSubmitting ? "…" : "I'm here"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            trackEvent("REPORT_STARTED", venue.id);
            setShowReport(true);
          }}
        >
          Report
        </button>
        <button className="btn btn-secondary" onClick={handleToggleSaved}>
          <Bookmark size={15} fill={venue.isSaved ? "currentColor" : "none"} /> {venue.isSaved ? "Saved" : "Save"}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {myOwnershipStatus === "VERIFIED" ? (
          <Link href={`/owner/${venue.id}`} className="btn btn-secondary">
            Manage
          </Link>
        ) : myOwnershipStatus === "PENDING" ? (
          <button className="btn btn-secondary" disabled title="An admin still needs to review this claim">
            Claim pending
          </button>
        ) : venue.claimStatus === "UNCLAIMED" || venue.claimStatus === "REJECTED" ? (
          <button className="btn btn-secondary" onClick={handleClaim} disabled={claiming}>
            {claiming ? "…" : "Claim venue"}
          </button>
        ) : (
          <div />
        )}
        <button className="btn btn-secondary" onClick={handleDirections}>
          <Navigation size={15} /> Directions
        </button>
        <button className="btn btn-secondary" onClick={handleShare}>
          <Share2 size={15} /> {shareMessage ?? "Share"}
        </button>
      </div>
      {imHereError && (
        <p className="text-sm mb-4 -mt-4" style={{ color: "var(--danger)" }}>
          {imHereError}
        </p>
      )}

      {process.env.NODE_ENV !== "production" && lastOwnReportId && (
        <button className="btn btn-ghost btn-sm mb-6" onClick={handleSimulateConfirmation}>
          Dev: simulate crowd confirmation for last report
        </button>
      )}

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
          onSubmitted={(result) => {
            setShowReport(false);
            handleReportSubmitted(result);
          }}
          onAnonymous={() => {
            setShowReport(false);
            setSignUpPrompt({ reason: "Create a free account to report activity.", intent: "report" });
          }}
        />
      )}

      {showQuickCheck && (
        <QuickPulseCheck
          venueId={venue.id}
          onClose={() => {
            setShowQuickCheck(false);
            offerShareAfter([]); // I'm Here alone still earns the share offer, even skipped
          }}
          onSubmitted={(result) => {
            setShowQuickCheck(false);
            handleReportSubmitted(result);
          }}
          onAnonymous={() => {
            setShowQuickCheck(false);
            setSignUpPrompt({ reason: "Create a free account to report activity.", intent: "report" });
          }}
        />
      )}

      {signUpPrompt && (
        <SignUpPrompt reason={signUpPrompt.reason} intent={signUpPrompt.intent} onClose={() => setSignUpPrompt(null)} />
      )}

      {showSharePrompt && (
        <ShareStatusPrompt
          venueName={venue.name}
          url={shareableUrl()}
          shareText={currentShareText()}
          onShared={() => trackEvent("VENUE_SHARED", venue.id)}
          onClose={() => setShowSharePrompt(false)}
        />
      )}

      {toast && <ContributionSuccess {...toast} />}

      {celebratingBadge && (
        <BadgeCelebration
          badge={celebratingBadge}
          onClose={() => {
            setCelebratingBadge(null);
            celebrateNextBadge();
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
