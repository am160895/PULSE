"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Venue } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { VENUE_TYPE_LABELS } from "@/config/constants";
import { LoadingDots } from "@/components/ui/States";

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [query, setQuery] = useState("");
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
    if (!q) return venues;
    return venues.filter((v) => v.name.toLowerCase().includes(q) || v.neighborhood.toLowerCase().includes(q));
  }, [venues, query]);

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
        <Link href="/admin/venues/new" className="btn btn-primary">
          <Plus size={16} /> New venue
        </Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search venues..."
        className="input mb-4 max-w-sm"
      />

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
