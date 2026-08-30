"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { VenueOpenState, VenueType } from "@/types";
import { VENUE_TYPE_LABELS } from "@/config/constants";

export interface DirectoryEntry {
  id: string;
  name: string;
  neighborhood: string;
  venueType: VenueType;
  streetAddress: string;
  city: string;
  openState: VenueOpenState;
  displayText: string;
}

export function DirectoryList({ venues }: { venues: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<VenueType | null>(null);

  // Only offer chips for types that actually appear — no dead "Event Space" chip when
  // this directory (bars, not restaurants) happens to have zero of them.
  const availableTypes = useMemo(() => {
    const present = new Set(venues.map((v) => v.venueType));
    return (Object.keys(VENUE_TYPE_LABELS) as VenueType[]).filter((t) => present.has(t));
  }, [venues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return venues.filter((v) => {
      if (activeType && v.venueType !== activeType) return false;
      if (!q) return true;
      return v.name.toLowerCase().includes(q) || v.neighborhood.toLowerCase().includes(q);
    });
  }, [venues, query, activeType]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 h-11 mb-3">
        <Search size={16} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bars, neighborhoods..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--text-muted)]"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: "none" }}>
        <button
          className={`filter-chip ${activeType === null ? "active" : ""}`}
          onClick={() => setActiveType(null)}
          aria-pressed={activeType === null}
        >
          All
        </button>
        {availableTypes.map((t) => (
          <button
            key={t}
            className={`filter-chip ${activeType === t ? "active" : ""}`}
            onClick={() => setActiveType((prev) => (prev === t ? null : t))}
            aria-pressed={activeType === t}
          >
            {VENUE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--text-secondary)] py-8 text-center">No places match that search.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((v) => (
            <Link
              key={v.id}
              href={`/venue/${v.id}`}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-[15px] truncate">{v.name}</p>
                <p className="text-[13px] text-[var(--text-secondary)] truncate">
                  {v.neighborhood} · {VENUE_TYPE_LABELS[v.venueType]}
                </p>
              </div>
              <div
                className="shrink-0 text-[12px] text-right"
                style={{ color: v.openState === "OPEN" || v.openState === "CLOSING_SOON" ? "var(--active)" : "var(--text-muted)" }}
              >
                {v.displayText}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
