"use client";

import { useEffect, useState } from "react";
import type { Perk } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { LoadingDots } from "@/components/ui/States";

const EMPTY_FORM = { title: "", description: "", requiredMinXp: "0" };

export function PerksAdmin() {
  const [perks, setPerks] = useState<Perk[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    requestJson<{ perks: Perk[] }>("/api/admin/perks").then((result) => {
      if (result.ok) setPerks(result.data.perks);
      else setError(result.error);
    });
  }

  useEffect(load, []);

  async function create() {
    setSaving(true);
    setError(null);
    const result = await requestJson<{ perk: Perk }>("/api/admin/perks", {
      method: "POST",
      body: {
        title: form.title,
        description: form.description,
        requiredMinXp: Number(form.requiredMinXp) || 0,
        isActive: true,
      },
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(EMPTY_FORM);
    load();
  }

  async function toggleActive(perk: Perk) {
    const result = await requestJson(`/api/admin/perks/${perk.id}`, { method: "PATCH", body: { isActive: !perk.isActive } });
    if (result.ok) load();
    else setError(result.error);
  }

  async function remove(perk: Perk) {
    if (!confirm(`Delete "${perk.title}" permanently? This can't be undone.`)) return;
    const result = await requestJson(`/api/admin/perks/${perk.id}`, { method: "DELETE" });
    if (result.ok) load();
    else setError(result.error);
  }

  return (
    <div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-5 max-w-lg">
        <h3 className="mb-3">Add a perk</h3>
        <div className="flex flex-col gap-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title (e.g. Free coat check)"
            className="input"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="input"
          />
          <label className="text-[13px] text-[var(--text-secondary)]">Minimum XP required</label>
          <input
            type="number"
            min={0}
            value={form.requiredMinXp}
            onChange={(e) => setForm({ ...form, requiredMinXp: e.target.value })}
            className="input"
          />
          <button
            onClick={create}
            disabled={saving || !form.title.trim() || !form.description.trim()}
            className="btn btn-primary mt-1"
          >
            {saving ? "Adding…" : "Add perk"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}
      {!perks && <LoadingDots />}

      {perks && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Min XP</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {perks.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.title}</td>
                  <td>{p.description}</td>
                  <td>{p.requiredMinXp.toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(p)}
                      className={`badge ${p.isActive ? "badge-high" : "badge-low"}`}
                      style={{ border: "none", cursor: "pointer" }}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => remove(p)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {perks.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-[var(--text-secondary)]">
                    No perks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
