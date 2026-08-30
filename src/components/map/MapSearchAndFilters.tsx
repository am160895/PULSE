"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

export type MapFilter =
  | "HOT"
  | "RISING"
  | "BEST_BET"
  | "FRIENDS"
  | "NO_LINE"
  | "LATER_TONIGHT"
  | "BAR"
  | "CLUB"
  | "ROOFTOP"
  | "LIVE_MUSIC";

// Primary layer stays on screen at all times (§11: reduce filter overload); everything
// else lives behind "More" so the first screen isn't a wall of chips. There's no "Open
// now" chip here — the map only ever shows open venues as circles, unconditionally (see
// map/page.tsx), so it isn't something a user needs to toggle.
const PRIMARY_FILTERS: { key: MapFilter; label: string }[] = [
  { key: "HOT", label: "Hot now" },
  { key: "RISING", label: "Rising" },
  { key: "BEST_BET", label: "Best bet" },
  { key: "NO_LINE", label: "No line" },
  { key: "FRIENDS", label: "Friends" },
];

const SECONDARY_FILTERS: { key: MapFilter; label: string }[] = [
  { key: "LATER_TONIGHT", label: "Later tonight" },
  { key: "BAR", label: "Bars" },
  { key: "CLUB", label: "Clubs" },
  { key: "ROOFTOP", label: "Rooftops" },
  { key: "LIVE_MUSIC", label: "Live music" },
];

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  active: Set<MapFilter>;
  onToggle: (f: MapFilter) => void;
}

export function MapSearchAndFilters({ query, onQueryChange, active, onToggle }: Props) {
  const [showMore, setShowMore] = useState(false);
  const activeSecondaryCount = SECONDARY_FILTERS.filter((f) => active.has(f.key)).length;

  return (
    <>
      <div className="map-search">
        <Search size={16} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search neighborhoods, venues, music..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--text-muted)]"
        />
        {query && (
          <button onClick={() => onQueryChange("")} aria-label="Clear search">
            <X size={15} color="var(--text-muted)" />
          </button>
        )}
      </div>

      <div className="filter-row" style={{ top: "calc(env(safe-area-inset-top) + 66px)" }}>
        {PRIMARY_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${active.has(f.key) ? "active" : ""}`}
            onClick={() => onToggle(f.key)}
            aria-pressed={active.has(f.key)}
          >
            {f.label}
          </button>
        ))}

        <button
          className={`filter-chip ${showMore ? "active" : ""}`}
          onClick={() => setShowMore((v) => !v)}
          aria-pressed={showMore}
          aria-label="More filters"
        >
          <SlidersHorizontal size={13} />
          {activeSecondaryCount > 0 ? ` ${activeSecondaryCount}` : ""}
        </button>
      </div>

      {showMore && (
        <div className="filter-row" style={{ top: "calc(env(safe-area-inset-top) + 108px)" }}>
          {SECONDARY_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${active.has(f.key) ? "active" : ""}`}
              onClick={() => onToggle(f.key)}
              aria-pressed={active.has(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
