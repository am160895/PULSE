"use client";

import { useMemo, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { MapSearchAndFilters, type MapFilter } from "@/components/map/MapSearchAndFilters";
import { VenueBottomSheet } from "@/components/venues/VenueBottomSheet";
import { useInvalidateVenue, useVenueSearch, useVenuesInBounds, type BoundsParams, type CoverageMode } from "@/hooks/api";
import { requestJson } from "@/lib/http/requestJson";

export default function MapPage() {
  const [bounds, setBounds] = useState<BoundsParams | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // OPEN_NOW is default-on during nightlife browsing (spec §22).
  const [activeFilters, setActiveFilters] = useState<Set<MapFilter>>(new Set(["OPEN_NOW"]));
  const [coverage, setCoverage] = useState<CoverageMode>("NOW");
  const invalidate = useInvalidateVenue();

  const { data: boundsVenues } = useVenuesInBounds(bounds, userLocation, coverage);
  const { data: searchVenues } = useVenueSearch(query);

  const venues = useMemo(() => {
    const base = query.trim() ? searchVenues ?? [] : boundsVenues ?? [];
    const filtered =
      activeFilters.size === 0
        ? base
        : base.filter((v) => {
            for (const f of activeFilters) {
              if (f === "HOT" && v.pulse.pulseLabel !== "HOT_NOW") return false;
              if (f === "RISING" && v.pulse.trend !== "RISING" && v.pulse.trend !== "RISING_FAST") return false;
              if (f === "FRIENDS" && (v.friendsPresent?.length ?? 0) === 0) return false;
              if (f === "NO_LINE" && v.pulse.waitEstimate && (v.pulse.waitEstimate.maxMinutes ?? 99) > 5) return false;
              // Excludes venues we're actually confident are closed — never venues with
              // simply no hours on file. Absence of hours data isn't evidence of being
              // closed, and hiding real, possibly-open bars just because nobody has
              // entered their hours yet defeats the point of a discovery map.
              if (
                f === "OPEN_NOW" &&
                (v.openState === "CLOSED" || v.openState === "TEMPORARILY_CLOSED" || v.openState === "PERMANENTLY_CLOSED")
              )
                return false;
              // Closed-but-opening-later — more useful than simply hiding every closed
              // venue (spec §23).
              if (f === "LATER_TONIGHT" && !(v.currentPulseStatus === "CLOSED" && v.openStatus.nextOpenAt)) return false;
              if (f === "BAR" && v.venueType !== "BAR") return false;
              if (f === "CLUB" && v.venueType !== "CLUB") return false;
              if (f === "ROOFTOP" && v.venueType !== "ROOFTOP") return false;
              if (f === "LIVE_MUSIC" && v.venueType !== "LIVE_MUSIC") return false;
            }
            return true;
          });

    if (!activeFilters.has("LATER_TONIGHT")) return filtered;
    // Soonest-opening-first is the whole point of this filter — a flat unsorted list of
    // "closed, opens sometime later" venues wouldn't be meaningfully more useful than no
    // list at all.
    return [...filtered].sort((a, b) => {
      const aTime = a.openStatus.nextOpenAt ? new Date(a.openStatus.nextOpenAt).getTime() : Infinity;
      const bTime = b.openStatus.nextOpenAt ? new Date(b.openStatus.nextOpenAt).getTime() : Infinity;
      return aTime - bTime;
    });
  }, [boundsVenues, searchVenues, query, activeFilters]);

  const selectedVenue = venues.find((v) => v.id === selectedId) ?? null;

  // OPEN_NOW and LATER_TONIGHT are opposite views of the map (currently open vs
  // currently closed) — active together they'd always show nothing, so selecting one
  // clears the other rather than silently producing an empty map.
  function toggleFilter(f: MapFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) {
        next.delete(f);
      } else {
        if (f === "OPEN_NOW") next.delete("LATER_TONIGHT");
        if (f === "LATER_TONIGHT") next.delete("OPEN_NOW");
        next.add(f);
      }
      return next;
    });
  }

  async function handleToggleSaved(venueId: string) {
    const result = await requestJson(`/api/venues/${venueId}/saved`, { method: "POST" });
    if (result.ok) invalidate(venueId);
    // A failed save silently no-ops rather than crashing — the bookmark icon just won't
    // change, which is an acceptable (if unexciting) fallback for a non-critical toggle
    // triggered from a compact bottom-sheet with no room for an inline error message.
  }

  return (
    <div className="fixed inset-0">
      <MapView
        venues={venues}
        selectedVenueId={selectedId}
        onSelectVenue={setSelectedId}
        onBoundsChange={setBounds}
        onUserLocation={setUserLocation}
      />
      <MapSearchAndFilters
        query={query}
        onQueryChange={setQuery}
        active={activeFilters}
        onToggle={toggleFilter}
        coverage={coverage}
        onCoverageChange={setCoverage}
      />
      {selectedVenue && (
        <VenueBottomSheet venue={selectedVenue} onClose={() => setSelectedId(null)} onToggleSaved={handleToggleSaved} />
      )}
    </div>
  );
}
