"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminProfileView } from "@/lib/data/social";
import { requestJson } from "@/lib/http/requestJson";
import { LoadingDots } from "@/components/ui/States";

export function UsersTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminProfileView[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    requestJson<{ users: AdminProfileView[] }>("/api/admin/users").then((result) => {
      if (result.ok) setUsers(result.data.users);
      else setError(result.error);
    });
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.profile.username.toLowerCase().includes(q) || u.profile.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  async function toggleRole(user: AdminProfileView) {
    const nextRole = user.profile.role === "ADMIN" ? "USER" : "ADMIN";
    const result = await requestJson(`/api/admin/users/${user.profile.id}`, { method: "PATCH", body: { role: nextRole } });
    if (result.ok) load();
    else setError(result.error);
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users..."
        className="input mb-4 max-w-sm"
      />

      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}
      {!users && <LoadingDots />}

      {users && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Reports</th>
                <th>Trust</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.profile.id === currentUserId;
                return (
                  <tr key={u.profile.id}>
                    <td>{u.profile.displayName}</td>
                    <td>@{u.profile.username}</td>
                    <td>{u.email}</td>
                    <td>{u.reportsSubmitted}</td>
                    <td>{u.trustScore.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${u.profile.role === "ADMIN" ? "badge-high" : ""}`}>{u.profile.role}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleRole(u)}
                        disabled={isSelf}
                        title={isSelf ? "You can't change your own role" : undefined}
                        className="btn btn-ghost btn-sm"
                      >
                        {u.profile.role === "ADMIN" ? "Demote" : "Promote"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
