"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import type { Venue } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { LoadingDots } from "@/components/ui/States";

/** ADMIN/VENUE_OWNER hours have actually been looked at by a human; SEED/GOOGLE_PLACES
 * haven't (SEED is this app's placeholder/best-guess data, and GOOGLE_PLACES is only ever
 * hypothetical — no code path writes it, see lib/geo/nominatim.ts's own free-only stance).
 * No hours at all is its own "needs review" case, not lumped in with "verified." */
function hoursNeedsReview(venue: Venue): boolean {
  if (venue.hours.length === 0) return true;
  return venue.hours.some((h) => h.source !== "ADMIN" && h.source !== "VENUE_OWNER");
}

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [query, setQuery] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    requestJson<{ venues: Venue[] }>("/api/admin/venues").then((result) => {
      if (result.ok) setVenues(result.data.venues);
      else setError(result.error);
    });
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!venues) return [];
    const q = query.trim().toLowerCase();
    return venues
      .filter((v) => !q || v.name.toLowerCase().includes(q) || v.neighborhood.toLowerCase().includes(q))
      .filter((v) => !needsReviewOnly || hoursNeedsReview(v));
  }, [venues, query, needsReviewOnly]);

  const needsReviewCount = useMemo(() => venues?.filter(hoursNeedsReview).length ?? 0, [venues]);

  async function toggleActive(venue: Venue) {
    const result = await requestJson(`/api/admin/venues/${venue.id}`, { method: "PATCH", body: { isActive: !venue.isActive } });
    if (result.ok) load();
    else setError(result.error);
  }

  async function remove(venue: Venue) {
    if (!confirm(`Delete "${venue.name}" permanently? This can't be undone. (Consider deactivating instead.)`)) return;
    const result = await requestJson(`/api/admin/venues/${venue.id}`, { method: "DELETE" });
    if (result.ok) load();
    else setError(result.error);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1>Venues</h1>
        <div className="flex gap-2">
          <Link href="/admin/venues/import" className="btn btn-secondary">
            <Upload size={16} /> Import
          </Link>
          <Link href="/admin/venues/new" className="btn btn-primary">
            <Plus size={16} /> New venue
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search venues..."
          className="input max-w-sm"
        />
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] whitespace-nowrap">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
          Needs hours review ({needsReviewCount})
        </label>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}
      {!venues && <LoadingDots />}

      {venues && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Neighborhood</th>
                <th>Source</th>
                <th>Hours</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/admin/venues/${v.id}`} className="font-medium">
                      {v.name}
                    </Link>
                  </td>
                  <td>{VENUE_TYPE_LABELS[v.venueType]}</td>
                  <td>{v.neighborhood}</td>
                  <td>{v.externalPlaceId ? "Google" : "Manual"}</td>
                  <td>
                    <span className={`badge ${hoursNeedsReview(v) ? "badge-low" : "badge-high"}`}>
                      {v.hours.length === 0 ? "No hours" : hoursNeedsReview(v) ? "Unverified" : "Verified"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => toggleActive(v)} className={`badge ${v.isActive ? "badge-high" : "badge-low"}`} style={{ border: "none", cursor: "pointer" }}>
                      {v.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => remove(v)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
