import { countReportsInLastHours, listAllVenuesForAdmin } from "@/lib/data/repository";
import { listAllProfilesForAdmin } from "@/lib/data/social";

export default async function AdminDashboardPage() {
  const [venues, users, reportsLast24h] = await Promise.all([
    listAllVenuesForAdmin(),
    listAllProfilesForAdmin(),
    countReportsInLastHours(24),
  ]);
  const activeVenues = venues.filter((v) => v.isActive).length;
  const admins = users.filter((u) => u.profile.role === "ADMIN").length;
  const directoryVenues = venues.filter((v) => !!v.externalPlaceId).length;

  return (
    <div>
      <h1 className="mb-1">Dashboard</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">
        Backed by Supabase — see README §15/§29 for how this is wired.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Metric label="Venues" value={venues.length} sub={`${activeVenues} active`} />
        <Metric label="Google-sourced" value={directoryVenues} sub="via search" />
        <Metric label="Users" value={users.length} sub={`${admins} admin${admins === 1 ? "" : "s"}`} />
        <Metric label="Reports, 24h" value={reportsLast24h} />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-2">Manage</h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Use the sidebar to create/edit/deactivate venues or change a user&apos;s role. Every
          write here goes through the same repository functions the rest of the app uses — a
          venue you create here shows up on the map immediately, scored by the same engine.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="text-[12px] text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}
