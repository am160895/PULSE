"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminOwnershipRequestView } from "@/lib/data/ownership";
import { requestJson } from "@/lib/http/requestJson";
import { LoadingDots } from "@/components/ui/States";

export function ClaimsTable() {
  const [requests, setRequests] = useState<AdminOwnershipRequestView[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    requestJson<{ requests: AdminOwnershipRequestView[] }>("/api/admin/venue-owners").then((result) => {
      if (result.ok) setRequests(result.data.requests);
      else setError(result.error);
    });
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!requests) return [];
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) => r.venueName.toLowerCase().includes(q) || r.requester.displayName.toLowerCase().includes(q) || r.requester.username.toLowerCase().includes(q),
    );
  }, [requests, query]);

  async function setStatus(id: string, status: "VERIFIED" | "REJECTED" | "REVOKED") {
    const result = await requestJson(`/api/admin/venue-owners/${id}`, { method: "PATCH", body: { status } });
    if (result.ok) load();
    else setError(result.error);
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search claims..."
        className="input mb-4 max-w-sm"
      />

      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}
      {!requests && <LoadingDots />}

      {requests && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Venue</th>
                <th>Requested by</th>
                <th>Status</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.request.id}>
                  <td>{r.venueName}</td>
                  <td>
                    {r.requester.displayName} (@{r.requester.username})
                  </td>
                  <td>
                    <span className={`badge ${r.request.status === "VERIFIED" ? "badge-high" : ""}`}>{r.request.status}</span>
                  </td>
                  <td>{new Date(r.request.requestedAt).toLocaleDateString()}</td>
                  <td className="flex gap-2">
                    {r.request.status === "PENDING" && (
                      <>
                        <button onClick={() => setStatus(r.request.id, "VERIFIED")} className="btn btn-ghost btn-sm">
                          Approve
                        </button>
                        <button onClick={() => setStatus(r.request.id, "REJECTED")} className="btn btn-ghost btn-sm">
                          Reject
                        </button>
                      </>
                    )}
                    {r.request.status === "VERIFIED" && (
                      <button onClick={() => setStatus(r.request.id, "REVOKED")} className="btn btn-ghost btn-sm">
                        Revoke
                      </button>
                    )}
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
