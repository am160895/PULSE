import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { listVenues } from "@/lib/data/repository";
import { getVenueOpenStatus } from "@/lib/venues/getVenueOpenStatus";
import { DirectoryList, type DirectoryEntry } from "@/components/directory/DirectoryList";

export default async function DirectoryPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const venues = await listVenues();
  const now = new Date();

  // Deliberately lightweight: a directory is a browsable reference list, not a live-activity
  // view, so this skips Pulse Score/report computation entirely (composeVenue.ts's full
  // pipeline) — just the open/closed read straight off each venue's own hours, which
  // listVenues() already returns embedded (no extra queries needed regardless of how many
  // venues exist). Special-hours overrides are skipped here for the same reason (a real but
  // rare simplification — a venue with an unusual one-off closure might show slightly stale
  // status in this list only; the venue detail page always computes the accurate version).
  const entries: DirectoryEntry[] = venues
    .filter((v) => v.isActive && v.venueType !== "RESTAURANT")
    .map((v) => {
      const openStatus = getVenueOpenStatus(v.hours, [], now, v.timezone, v.businessStatus);
      return {
        id: v.id,
        name: v.name,
        neighborhood: v.neighborhood,
        venueType: v.venueType,
        streetAddress: v.streetAddress,
        city: v.city,
        openState: openStatus.status,
        displayText: openStatus.displayText,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-1">Directory</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-5">Every bar in PULSE, A–Z — {entries.length} places.</p>
      <DirectoryList venues={entries} />
    </div>
  );
}
