"use client";

import { use } from "react";
import { useOwnerDashboard, useVenueHistory } from "@/hooks/api";
import { LoadingDots } from "@/components/ui/States";
import { PulseLabelBadge, ConfidenceBadge, PulseScoreDisplay } from "@/components/venues/Badges";
import { VsTypicalBadge } from "@/components/venues/VsTypicalBadge";
import { ActivityGraph } from "@/components/venues/ActivityGraph";
import { NeighborhoodBenchmark } from "@/components/owner/NeighborhoodBenchmark";

export default function OwnerVenueDashboardPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data, isLoading, error } = useOwnerDashboard(venueId);
  const { data: history } = useVenueHistory(venueId);

  if (isLoading) return <LoadingDots />;
  if (error || !data) return <p className="text-[14px]" style={{ color: "var(--danger)" }}>Couldn&apos;t load this dashboard.</p>;

  const { venue, currentPulse, vsTypical, recentRollups, neighborhoodBenchmark } = data;
  const sectionLabelStyle = { fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" };

  return (
    <div>
      <h1 className="mb-1">{venue.name}</h1>
      <p className="mb-5 text-[13px] text-[var(--text-secondary)]">{venue.neighborhood}</p>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
        <div className="flex items-center gap-4">
          <PulseScoreDisplay score={currentPulse.pulseScore} label={currentPulse.pulseLabel} />
          <div className="flex flex-col gap-1.5 items-start">
            <PulseLabelBadge label={currentPulse.pulseLabel} />
            <ConfidenceBadge label={currentPulse.confidenceLabel} />
            {vsTypical && <VsTypicalBadge comparison={vsTypical} />}
          </div>
        </div>
      </div>

      <section className="mb-5">
        <h3 className="mb-2.5" style={sectionLabelStyle}>Tonight&apos;s activity</h3>
        {history ? <ActivityGraph past={history.past} forecast={history.forecast} /> : <LoadingDots />}
      </section>

      <section className="mb-5">
        <h3 className="mb-2.5" style={sectionLabelStyle}>Neighborhood</h3>
        <NeighborhoodBenchmark venuePulseScore={currentPulse.pulseScore} benchmark={neighborhoodBenchmark} />
      </section>

      {recentRollups.length > 0 && (
        <section>
          <h3 className="mb-2.5" style={sectionLabelStyle}>Recent nights</h3>
          <div className="flex flex-col gap-2">
            {recentRollups.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] px-3.5 py-2.5">
                <span className="text-[13px]">{r.nightlifeDate}</span>
                <span className="text-[13px] font-medium tabular-nums">
                  avg {Math.round(r.avgPulseScore)} · peak {r.peakPulseScore}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
