import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getFunnelCounts } from "@/lib/data/analytics";

export default async function AdminAnalyticsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  const counts = await getFunnelCounts();

  const sections: { title: string; rows: { event: keyof typeof counts; label: string }[] }[] = [
    {
      title: "Discovery",
      rows: [
        { event: "LANDING_VIEW", label: "Landing page views" },
        { event: "MAP_VIEW", label: "Map views" },
        { event: "VENUE_VIEW", label: "Venue detail views" },
        { event: "SHARED_LINK_OPENED", label: "Shared links opened" },
      ],
    },
    {
      title: "Account",
      rows: [
        { event: "AUTH_STARTED", label: "Signup/login started" },
        { event: "AUTH_COMPLETED", label: "Signup/login completed" },
      ],
    },
    {
      title: "Contribution",
      rows: [
        { event: "REPORT_STARTED", label: "Reports started" },
        { event: "REPORT_COMPLETED", label: "Reports completed" },
        { event: "IM_HERE_COMPLETED", label: "\"I'm here\" completed" },
      ],
    },
    {
      title: "Sharing & growth",
      rows: [
        { event: "VENUE_SHARED", label: "Venues shared" },
        { event: "VENUE_SAVED", label: "Venues saved" },
        { event: "DIRECTIONS_CLICKED", label: "Directions clicked" },
        { event: "FRIEND_INVITED", label: "Friend invites sent" },
      ],
    },
  ];

  return (
    <div>
      <h1 className="mb-1">Acquisition funnel</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">
        All-time counts, privacy-respecting (named events only — no location or free-text payloads).
      </p>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2.5" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" }}>
              {section.title}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {section.rows.map((row) => (
                <div key={row.event} className="metric-card">
                  <div className="metric-label">{row.label}</div>
                  <div className="metric-value">{counts[row.event]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
