import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Shield } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { AnonymousGate } from "@/components/ui/AnonymousGate";
import { ProgressBar } from "@/components/gamification/ProgressBar";
import { BadgeMedallion } from "@/components/gamification/BadgeMedallion";
import { BADGE_CATALOG, neighborhoodBadgeDisplayName } from "@/lib/gamification/badgeCatalog";
import { levelForXp } from "@/lib/gamification/levels";
import {
  countDistinctOtherContributorsAtVenues,
  getUserProgress,
  listRecentXpEventsForUser,
  listUserBadges,
  listUserNeighborhoodProgress,
} from "@/lib/data/gamification";
import { SIGNAL_CONFIRMATION_MAX_AGE_MINUTES } from "@/config/constants";
import type { BadgeCode } from "@/types";

const REPORT_REWARD_TYPES = new Set(["CROWD_REPORT", "WAIT_REPORT", "ENERGY_REPORT"]);

function monthStartIso(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function YouPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.isAnonymous) {
    return <AnonymousGate next="/you" title="Track your PULSE profile" body="Create an account to earn XP, unlock badges, and build your neighborhood reputation." />;
  }

  const now = new Date();
  const [progress, neighborhoods, badges, recentEvents] = await Promise.all([
    getUserProgress(session.profile.id),
    listUserNeighborhoodProgress(session.profile.id),
    listUserBadges(session.profile.id),
    listRecentXpEventsForUser(session.profile.id, now),
  ]);

  const level = levelForXp(progress.totalXp);
  const monthCutoff = monthStartIso(now);
  const thisMonthEvents = recentEvents.filter((e) => e.createdAt >= monthCutoff);

  const reportEventsThisMonth = thisMonthEvents.filter((e) => REPORT_REWARD_TYPES.has(e.rewardType));
  const uniqueReportsThisMonth = new Set(reportEventsThisMonth.map((e) => e.sourceId)).size;

  // Accuracy confirmation rate: of reports old enough that we'd know by now whether the
  // crowd confirmed them (past the confirmation window, not just "not yet evaluated"),
  // what share actually were. Reports still inside the window are excluded rather than
  // counted as misses — they're pending, not failures.
  const eligibleReportIds = new Set(
    reportEventsThisMonth
      .filter((e) => (now.getTime() - new Date(e.createdAt).getTime()) / 60_000 > SIGNAL_CONFIRMATION_MAX_AGE_MINUTES)
      .map((e) => e.sourceId)
  );
  const confirmedReportIds = new Set(
    thisMonthEvents
      .filter((e) => e.rewardType === "SIGNAL_CONFIRMED")
      .map((e) => String(e.metadata?.confirmedReportId ?? ""))
      .filter(Boolean)
  );
  const confirmationRate =
    eligibleReportIds.size > 0
      ? Math.round((100 * [...eligibleReportIds].filter((id) => confirmedReportIds.has(id)).length) / eligibleReportIds.size)
      : null;

  const venueIdsThisMonth = [...new Set(thisMonthEvents.map((e) => e.venueId).filter((id): id is string => !!id))];
  const otherContributors = await countDistinctOtherContributorsAtVenues(venueIdsThisMonth, session.profile.id, monthCutoff);

  const badgesByCode = new Set(badges.filter((b) => b.neighborhood === "").map((b) => b.badgeCode));
  const neighborhoodInsiderAreas = new Set(
    badges.filter((b) => b.badgeCode === "NEIGHBORHOOD_INSIDER" && b.neighborhood !== "").map((b) => b.neighborhood)
  );
  const globalBadgeCodes = (Object.keys(BADGE_CATALOG) as BadgeCode[]).filter((c) => c !== "NEIGHBORHOOD_INSIDER");
  const foundingScoutSequence = badges.find((b) => b.badgeCode === "FOUNDING_SCOUT")?.sequenceNumber ?? null;

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-6">You</h1>

      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold"
          style={{ background: "var(--surface-2)" }}
        >
          {session.profile.displayName.charAt(0)}
        </div>
        <div>
          <p className="font-semibold">{session.profile.displayName}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">@{session.profile.username} · {session.profile.homeCity}</p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {level.label}
          </span>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">{progress.totalXp.toLocaleString()} PULSE XP</span>
        </div>
        <ProgressBar current={progress.totalXp - level.minXp} target={level.nextLevelXp ? level.nextLevelXp - level.minXp : null} />
      </div>

      <section className="mb-6">
        <h3 className="mb-2.5" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" }}>
          This month
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={String(uniqueReportsThisMonth)} label="Verified reports" />
          <StatCard value={confirmationRate !== null ? `${confirmationRate}%` : "—"} label="Accuracy confirmed" />
          <StatCard value={String(otherContributors)} label="Other contributors on your venues" />
        </div>
      </section>

      {(badgesByCode.size > 0 || neighborhoodInsiderAreas.size > 0) && (
        <section className="mb-6">
          <h3 className="mb-2.5" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" }}>
            Badges
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {globalBadgeCodes
              .filter((code) => badgesByCode.has(code))
              .map((code) => {
                const def = BADGE_CATALOG[code];
                const label =
                  code === "FOUNDING_SCOUT" && foundingScoutSequence != null
                    ? `Founding Scout #${String(foundingScoutSequence).padStart(3, "0")}`
                    : def.name;
                return (
                  <div key={code} className="flex flex-col items-center gap-1.5 text-center">
                    <BadgeMedallion motif={def.motif} size={52} unlocked />
                    <span className="text-[11px] font-medium leading-tight">{label}</span>
                  </div>
                );
              })}
            {[...neighborhoodInsiderAreas].map((neighborhood) => (
              <div key={neighborhood} className="flex flex-col items-center gap-1.5 text-center">
                <BadgeMedallion motif="location-signal" size={52} unlocked />
                <span className="text-[11px] font-medium leading-tight">{neighborhoodBadgeDisplayName(neighborhood)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {neighborhoods.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2.5" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" }}>
            Neighborhoods
          </h3>
          <div className="flex flex-col gap-2">
            {neighborhoods.map((n) => {
              const nLevel = levelForXp(n.xp);
              return (
                <div key={n.neighborhood} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] px-3.5 py-2.5">
                  <span className="text-[14px] font-medium">{n.neighborhood}</span>
                  <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                    {nLevel.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] mb-6">
        <SettingsLink href="/settings/privacy" icon={<Shield size={16} />} label="Privacy" />
        <SettingsLink href="/settings/notifications" icon={<Bell size={16} />} label="Notifications" />
      </div>

      <LogoutButton />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-3 text-center">
      <div className="text-[20px] font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function SettingsLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      <ChevronRight size={16} color="var(--text-muted)" />
    </Link>
  );
}
