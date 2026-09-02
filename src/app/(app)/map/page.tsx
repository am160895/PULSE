"use client";

import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { MapSearchAndFilters, type MapFilter, type OpenFilterMode } from "@/components/map/MapSearchAndFilters";
import { VenueBottomSheet } from "@/components/venues/VenueBottomSheet";
import { BestBetStrip } from "@/components/map/BestBetStrip";
import { OnboardingBanner } from "@/components/map/OnboardingBanner";
import { EmptyState } from "@/components/ui/States";
import { useInvalidateVenue, useVenueSearch, useVenuesInBounds, type BoundsParams } from "@/hooks/api";
import { requestJson } from "@/lib/http/requestJson";
import { isBestBetVenue } from "@/lib/pulse/explore";
import { trackEvent } from "@/lib/analytics/track";

const TYPE_FILTERS: MapFilter[] = ["BAR", "CLUB", "ROOFTOP", "LIVE_MUSIC"];

export default function MapPage() {
  useEffect(() => trackEvent("MAP_VIEW"), []);

  const [bounds, setBounds] = useState<BoundsParams | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  // The input itself always shows `query` immediately — only the network request (and the
  // marker-clearing re-render that comes with it) waits for typing to pause, so search
  // doesn't fire, and flash the map's markers, on every single keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<MapFilter>>(new Set());
  // Defaults to open-only — the map is meant to answer "where's actually open right now,"
  // and closed venues cluttering the default view undercut that. "All" is one tap away for
  // anyone who wants the full directory, closed ones clearly greyed out (see MapView).
  const [openFilterMode, setOpenFilterMode] = useState<OpenFilterMode>("OPEN_NOW");
  const invalidate = useInvalidateVenue();

  // isLoadingError (not isError) specifically: TanStack Query still flips isError on a
  // background refetch failure even while good cached data remains, which must NOT block
  // the whole map — only isLoadingError means "we've never had data and this attempt
  // failed too," the one case where there's nothing to fall back on and it's genuinely
  // stuck without this.
  const { data: boundsVenues, isLoadingError: boundsLoadError, refetch: refetchBounds } = useVenuesInBounds(bounds, userLocation);
  const { data: searchVenues, isLoadingError: searchLoadError } = useVenueSearch(debouncedQuery);

  function isClosedState(v: { openState: string }) {
    return v.openState === "CLOSED" || v.openState === "TEMPORARILY_CLOSED" || v.openState === "PERMANENTLY_CLOSED";
  }

  // Everything currently in bounds (or matching the search), before any chip/open-state
  // filtering — this, not the filtered `venues` below, is what MapView clusters against.
  // Clustering has to be built from a STABLE set: if it were built from the filtered list,
  // every filter toggle would hand Supercluster a different point set and reshuffle which
  // venues group together, so an open venue could visibly jump between "its own dot" and
  // "folded into a cluster's count" purely from toggling Open now/All — same venues, same
  // positions, just regrouped. Filtering only decides what's actually visible afterward
  // (see visibleVenueIds), never what clusters with what.
  const clusterableVenues = useMemo(
    () => (debouncedQuery.trim() ? searchVenues ?? [] : boundsVenues ?? []),
    [debouncedQuery, searchVenues, boundsVenues]
  );

  const venues = useMemo(() => {
    const searching = debouncedQuery.trim().length > 0;

    // Searching is "find this specific place" — a deliberate lookup, not discovery
    // browsing, so it isn't filtered by vibe/type/open-state chips at all. A closed venue
    // found by name still shows (as a de-emphasized marker — see MapView), just honestly
    // marked closed once opened, rather than silently vanishing from search results.
    if (searching) return clusterableVenues;

    const filtered = clusterableVenues.filter((v) => {
      // Excludes venues we're actually confident are closed — never venues with simply no
      // hours on file, since absence of hours data isn't evidence of being closed. "Later
      // tonight" is the one deliberate exception, even while in Open-now mode — that view
      // exists specifically to surface closed-but-opening-later venues.
      if (openFilterMode === "OPEN_NOW" && isClosedState(v) && !activeFilters.has("LATER_TONIGHT")) return false;

      // Venue-type chips (Bar/Club/Rooftop/Live music) OR together, not AND — a venue only
      // ever has one venueType, so requiring it to match every checked type at once (the
      // old behavior, same loop as every other filter) made picking two type chips together
      // silently impossible to satisfy, always zeroing the map. Checking multiple types is
      // "show me any of these," same as a real filter facet — every other filter below still
      // ANDs together, since e.g. Hot AND Friends is a real, satisfiable combination.
      const activeTypeFilters = TYPE_FILTERS.filter((f) => activeFilters.has(f));
      if (activeTypeFilters.length > 0 && !activeTypeFilters.some((f) => v.venueType === f)) return false;

      for (const f of activeFilters) {
        // pulseLabel/trend already blend live reports with historical-baseline
        // popularity, weighted toward whichever is more trustworthy right now (see
        // calculatePulseScore) — Hot now/Rising key off that directly, so they still
        // surface something on a typical-Tuesday-afternoon map with zero live reports
        // instead of coming back empty. Freshness honesty is handled at the text/badge
        // level (FreshnessBadge, "No live pulse yet"), not by hiding these from filters.
        if (f === "HOT" && v.pulse.pulseLabel !== "HOT_NOW") return false;
        if (f === "RISING" && v.pulse.trend !== "RISING" && v.pulse.trend !== "RISING_FAST") return false;
        // Same predicate the Explore tab's Best Bet section uses (lib/pulse/explore.ts) —
        // one definition, so the map and Explore never silently disagree on what counts.
        if (f === "BEST_BET" && !isBestBetVenue(v, new Date())) return false;
        if (f === "FRIENDS" && (v.friendsPresent?.length ?? 0) === 0) return false;
        if (f === "LATER_TONIGHT" && !(v.currentPulseStatus === "CLOSED" && v.openStatus.nextOpenAt)) return false;
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
  }, [clusterableVenues, debouncedQuery, activeFilters, openFilterMode]);

  const visibleVenueIds = useMemo(() => new Set(venues.map((v) => v.id)), [venues]);

  const selectedVenue = venues.find((v) => v.id === selectedId) ?? null;

  const isSearching = debouncedQuery.trim().length > 0;
  // A genuinely empty result needs an explanation, or the map just looks broken — but WHY
  // it's empty matters: blaming "nothing's open" when a vibe/type chip (not the open-state
  // toggle) is what actually zeroed out the list is simply false and sends someone toward
  // the wrong fix (switching to All won't help if "Hot now" is the real reason).
  const dataLoaded = isSearching ? searchVenues !== undefined : boundsVenues !== undefined;
  const hasChipFilters = activeFilters.size > 0;
  const showEmptyState = dataLoaded && venues.length === 0 && !isSearching && (openFilterMode === "OPEN_NOW" || hasChipFilters);
  // Search had no dedicated empty/error state at all before — a bad query or a transient
  // failure both just looked like the map silently doing nothing.
  const showNoSearchResults = isSearching && !searchLoadError && searchVenues !== undefined && venues.length === 0;

  function toggleFilter(f: MapFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) {
        next.delete(f);
      } else {
        next.add(f);
      }
      return next;
    });
  }

  function clearFilters() {
    setActiveFilters(new Set());
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

  if (boundsLoadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6">
        <EmptyState
          title="Couldn't load the map"
          body="Something went wrong reaching PULSE. Check your connection and try again."
          action={
            <button className="btn btn-secondary" onClick={() => refetchBounds()}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      <MapView
        venues={clusterableVenues}
        visibleVenueIds={visibleVenueIds}
        isDataLoading={boundsVenues === undefined}
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
        openFilterMode={openFilterMode}
        onOpenFilterModeChange={setOpenFilterMode}
      />
      <OnboardingBanner />
      {showEmptyState &&
        (hasChipFilters ? (
          <div className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-6 text-center">
            <p className="mb-3 text-[14px] text-[var(--text-secondary)]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
              Nothing matches that filter right now — try a different one, or clear it.
            </p>
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-6 text-center">
            <p className="mb-3 text-[14px] text-[var(--text-secondary)]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
              Nothing&apos;s open right now — see what&apos;s opening later, or search for a place by name.
            </p>
            <button className="btn btn-secondary" onClick={() => toggleFilter("LATER_TONIGHT")}>
              Opening later tonight
            </button>
          </div>
        ))}

      {isSearching && searchLoadError && (
        <div className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-6 text-center">
          <p className="mb-3 text-[14px] text-[var(--text-secondary)]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
            Couldn&apos;t search right now — check your connection and try again.
          </p>
          <button className="btn btn-secondary" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}

      {showNoSearchResults && (
        <div className="fixed left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-6 text-center">
          <p className="mb-3 text-[14px] text-[var(--text-secondary)]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
            No results for &quot;{debouncedQuery.trim()}&quot;.
          </p>
          <button className="btn btn-secondary" onClick={() => setQuery("")}>
            Clear search
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
