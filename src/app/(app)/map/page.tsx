"use client";

import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { MapSearchAndFilters, type MapFilter } from "@/components/map/MapSearchAndFilters";
import { VenueBottomSheet } from "@/components/venues/VenueBottomSheet";
import { BestBetStrip } from "@/components/map/BestBetStrip";
import { OnboardingBanner } from "@/components/map/OnboardingBanner";
import { useInvalidateVenue, useVenueSearch, useVenuesInBounds, type BoundsParams, type CoverageMode } from "@/hooks/api";
import { requestJson } from "@/lib/http/requestJson";
import { isBestBetVenue } from "@/lib/pulse/explore";
import { trackEvent } from "@/lib/analytics/track";

export default function MapPage() {
  useEffect(() => trackEvent("MAP_VIEW"), []);

  const [bounds, setBounds] = useState<BoundsParams | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<MapFilter>>(new Set());
  const [coverage, setCoverage] = useState<CoverageMode>("NOW");
  const invalidate = useInvalidateVenue();

  const { data: boundsVenues } = useVenuesInBounds(bounds, userLocation, coverage);
  const { data: searchVenues } = useVenueSearch(query);

  function isClosedState(v: { openState: string }) {
    return v.openState === "CLOSED" || v.openState === "TEMPORARILY_CLOSED" || v.openState === "PERMANENTLY_CLOSED";
  }

  const venues = useMemo(() => {
    const searching = query.trim().length > 0;
    const base = searching ? searchVenues ?? [] : boundsVenues ?? [];

    // Searching is "find this specific place" — a deliberate lookup, not discovery
    // browsing, so it isn't filtered by vibe/type/open-state chips at all. A closed venue
    // found by name still shows (as a de-emphasized marker — see MapView), just honestly
    // marked closed once opened, rather than silently vanishing from search results.
    if (searching) return base;

    const filtered = base.filter((v) => {
      // Hard rule, not a togglable filter: map circles are open venues only — never
      // venues with simply no hours on file, since absence of hours data isn't evidence
      // of being closed. The one deliberate exception is "Later tonight," which exists
      // specifically to surface closed-but-opening-later venues (spec §23).
      if (isClosedState(v) && !activeFilters.has("LATER_TONIGHT")) return false;

      for (const f of activeFilters) {
        if (f === "HOT" && v.pulse.pulseLabel !== "HOT_NOW") return false;
        if (f === "RISING" && v.pulse.trend !== "RISING" && v.pulse.trend !== "RISING_FAST") return false;
        // Same predicate the Explore tab's Best Bet section uses (lib/pulse/explore.ts) —
        // one definition, so the map and Explore never silently disagree on what counts.
        if (f === "BEST_BET" && !isBestBetVenue(v, new Date())) return false;
        if (f === "FRIENDS" && (v.friendsPresent?.length ?? 0) === 0) return false;
        if (f === "NO_LINE" && v.pulse.waitEstimate && (v.pulse.waitEstimate.maxMinutes ?? 99) > 5) return false;
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

  // The "open venues only" rule legitimately returns zero results outside nightlife hours
  // (e.g. mid-morning, when almost nothing is open) — a blank map with no explanation reads
  // as broken, not as "correctly nothing's open right now." Not shown while searching (an
  // empty search result is self-explanatory) or while actively browsing "Later tonight"
  // (that view is expected to be sparse/empty sometimes, not a broken-map signal).
  const dataLoaded = query.trim() ? searchVenues !== undefined : boundsVenues !== undefined;
  const showNothingOpenState = dataLoaded && venues.length === 0 && !query.trim() && !activeFilters.has("LATER_TONIGHT");

  function toggleFilter(f: MapFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  async function handleToggleSaved(venueId: string) {
    const result = await requestJson<{ isSaved: boolean }>(`/api/venues/${venueId}/saved`, { method: "POST" });
    if (result.ok) {
      invalidate(venueId);
      if (result.data.isSaved) trackEvent("VENUE_SAVED", venueId);
    }
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
      <OnboardingBanner />
      {showNothingOpenState && (
        <div className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-6 text-center">
          <p className="mb-3 text-[14px] text-[var(--text-secondary)]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
            Nothing&apos;s open right now — see what&apos;s opening later, or search for a place by name.
          </p>
          <button className="btn btn-secondary" onClick={() => toggleFilter("LATER_TONIGHT")}>
            Opening later tonight
          </button>
        </div>
      )}

      {selectedVenue ? (
        <VenueBottomSheet venue={selectedVenue} onClose={() => setSelectedId(null)} onToggleSaved={handleToggleSaved} />
      ) : (
        <BestBetStrip userLocation={userLocation} />
      )}
    </div>
  );
}
