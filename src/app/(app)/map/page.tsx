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
  const [activeFilters, setActiveFilters] = useState<Set<MapFilter>>(new Set());
  const [coverage, setCoverage] = useState<CoverageMode>("NOW");
  const invalidate = useInvalidateVenue();

  const { data: boundsVenues } = useVenuesInBounds(bounds, userLocation, coverage);
  const { data: searchVenues } = useVenueSearch(query);

  const venues = useMemo(() => {
    const base = query.trim() ? searchVenues ?? [] : boundsVenues ?? [];
    if (activeFilters.size === 0) return base;

    return base.filter((v) => {
      for (const f of activeFilters) {
        if (f === "HOT" && v.pulse.pulseLabel !== "HOT_NOW") return false;
        if (f === "RISING" && v.pulse.trend !== "RISING" && v.pulse.trend !== "RISING_FAST") return false;
        if (f === "FRIENDS" && (v.friendsPresent?.length ?? 0) === 0) return false;
        if (f === "NO_LINE" && v.pulse.waitEstimate && (v.pulse.waitEstimate.maxMinutes ?? 99) > 5) return false;
        if (f === "OPEN_NOW" && v.openState !== "OPEN" && v.openState !== "CLOSING_SOON") return false;
        if (f === "BAR" && v.venueType !== "BAR") return false;
        if (f === "CLUB" && v.venueType !== "CLUB") return false;
        if (f === "ROOFTOP" && v.venueType !== "ROOFTOP") return false;
        if (f === "LIVE_MUSIC" && v.venueType !== "LIVE_MUSIC") return false;
      }
      return true;
    });
  }, [boundsVenues, searchVenues, query, activeFilters]);

  const selectedVenue = venues.find((v) => v.id === selectedId) ?? null;

  function toggleFilter(f: MapFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
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
