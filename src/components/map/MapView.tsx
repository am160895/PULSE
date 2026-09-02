"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import { Radio } from "lucide-react";
import type { VenueWithPulse } from "@/types";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from "@/config/constants";
import { mapMarkerClass } from "@/lib/venues/markerColor";
import type { BoundsParams } from "@/hooks/api";
import { getUserLocationOnce } from "@/lib/geo/userLocation";

interface MapViewProps {
  /** Every venue in bounds (or matching the search), NOT pre-filtered by open-state/chip
   * filters — this is deliberately the full set so clustering stays stable regardless of
   * which filters are active. See `visibleVenueIds` for what's actually shown. */
  venues: VenueWithPulse[];
  /** Which of `venues` should actually render as a marker (or count toward a cluster)
   * right now. Filtering happens AFTER clustering, not before — clustering itself is
   * always built from every venue in bounds, so toggling a filter never reshuffles which
   * venues group together, only which ones show. */
  visibleVenueIds: Set<string>;
  /** True while the first venues fetch for the current viewport is still in flight — kept
   * separate from `isMapReady` so the loading overlay covers BOTH "tiles not painted yet"
   * and "circles haven't arrived yet," instead of revealing an empty-looking map first and
   * having markers visibly pop in a beat later. Only gates the very first load: a `false`
   * value latches internally so later background refreshes never re-trigger the overlay. */
  isDataLoading: boolean;
  selectedVenueId: string | null;
  /** Also called with `null` on a click that lands on empty map (not a marker) while a
   * venue is selected — the sheet's only dismiss path used to be its own small close
   * button, since the sheet deliberately doesn't block map clicks (see visibleVenueIds). */
  onSelectVenue: (venueId: string | null) => void;
  onBoundsChange: (bounds: BoundsParams) => void;
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
}

export function MapView({ venues, visibleVenueIds, isDataLoading, selectedVenueId, onSelectVenue, onBoundsChange, onUserLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Base map tiles come from an external CDN and MapLibre's own init/worker sequence adds
  // more delay on top — on a slow connection (or this dev sandbox) that can be several
  // seconds of a flat black screen with zero feedback, which reads as "broken," not
  // "loading." True until the style's tiles have actually painted (MapLibre's own "load"
  // event, not just the map object existing).
  const [isMapReady, setIsMapReady] = useState(false);
  // Latches true the first time loading finishes — set directly during render (React's
  // documented pattern for "remember something from a prop change") rather than in an
  // effect, since an effect here would just cause an extra, avoidable re-render.
  const [hasDataLoadedOnce, setHasDataLoadedOnce] = useState(false);
  if (!isDataLoading && !hasDataLoadedOnce) setHasDataLoadedOnce(true);
  // Keyed by a stable id ("venue:<id>" / "cluster:<cluster_id>") so renderMarkers can
  // reconcile in place — update position/class/text on an already-mounted marker — rather
  // than tearing down and recreating every marker on every call. Recreating unconditionally
  // used to make every marker replay its CSS mount animation (marker-in) on every poll
  // refresh, pan, zoom, or selection change, which looked like the whole map "glitching" —
  // markers popping/rescaling in place every few seconds instead of just updating quietly.
  const markersMapRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const venuesRef = useRef(venues);
  const visibleVenueIdsRef = useRef(visibleVenueIds);
  const onSelectRef = useRef(onSelectVenue);
  const selectedVenueIdRef = useRef(selectedVenueId);
  const renderMarkersRef = useRef<() => void>(() => {});
  // Supercluster only needs rebuilding when the venue set itself changes, not on every
  // pan/zoom (moveend) or selection change — cache it keyed on the venues array reference.
  // byId travels with it (same rebuild trigger) so every marker lookup during a render is
  // O(1) instead of an O(n) `.find()` — with clustering now walking cluster leaves too
  // (see visibleVenueIds), a linear scan per lookup would otherwise multiply out fast.
  const clusterIndexRef = useRef<{ venues: VenueWithPulse[]; index: Supercluster; byId: Map<string, VenueWithPulse> } | null>(null);

  // Keep "latest value" refs in an effect (not during render) so event handlers created
  // once inside the map-init effect below always see current props/state without
  // needing the map itself to be re-created on every prop/state change. selectedVenueId
  // needs this too — renderMarkers is created once in a mount-only effect, so without a
  // ref it would forever compare against the selectedVenueId value from first mount and
  // the "selected" marker highlight would never actually update after a click.
  useEffect(() => {
    venuesRef.current = venues;
    visibleVenueIdsRef.current = visibleVenueIds;
    onSelectRef.current = onSelectVenue;
    selectedVenueIdRef.current = selectedVenueId;
  }, [venues, visibleVenueIds, onSelectVenue, selectedVenueId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const markers = markersMapRef.current; // stable Map instance — captured for cleanup below

    // MapLibre GL's default worker loading relies on the bundler correctly resolving
    // an `import.meta.url`-relative worker chunk. Turbopack (as of Next 16.3) doesn't
    // resolve that path and instead serves Next's HTML 404 fallback for it, which
    // silently breaks map rendering ("Failed to load module script ... MIME type
    // text/html", and `load` never fires). MapLibre ships a prebuilt worker bundle
    // exactly for bundlers like this — served from /public and pointed to explicitly.
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [MAP_DEFAULT_CENTER.lng, MAP_DEFAULT_CENTER.lat],
      zoom: MAP_DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const emitBounds = () => {
      const b = map.getBounds();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
      renderMarkers();
    };

    map.on("load", () => {
      emitBounds();
      setIsMapReady(true);
    });
    map.on("moveend", emitBounds);
    // Marker elements are a separate DOM overlay outside the WebGL canvas, so a marker
    // click never reaches this — only a genuine tap on empty map does, which is exactly
    // the "tap outside to dismiss" gap the bottom sheet itself can't cover without also
    // blocking clicks meant for other markers (its own click-through fix relies on that).
    map.on("click", () => {
      if (selectedVenueIdRef.current) onSelectRef.current(null);
    });
    renderMarkersRef.current = renderMarkers;

    // MapLibre measures its container's actual pixel size once at construction and never
    // re-checks on its own — if the container hadn't finished settling into its final
    // layout size at that exact moment (observed: the map appears blank/emptied of
    // markers on first load, and only switching tabs away and back — which forces the
    // browser to repaint — fixes it), the canvas stays sized for that stale measurement
    // forever. A ResizeObserver catches the container's real size whenever it changes,
    // including the very first settle right after mount, and tells the map to re-measure
    // and redraw — the standard fix for this class of MapLibre/Mapbox GL bug.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    // getBounds()/getZoom() are synchronously valid right after construction — don't
    // make the first render of markers wait on the `load` event, which fires on a
    // requestAnimationFrame callback and can be delayed by the browser (backgrounded
    // tabs throttle rAF entirely). `load`/`moveend` still handle every update after this.
    emitBounds();

    if (onUserLocation) {
      getUserLocationOnce().then((loc) => {
        if (loc) onUserLocation(loc);
      });
    }

    function renderMarkers() {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      // Built from the FULL venue set (see the `venues` prop doc) — never rebuilt just
      // because a filter toggled, only when the actual bounds/search data changes. This is
      // what keeps clustering geometry stable across filter toggles (see visibleVenueIds).
      if (clusterIndexRef.current?.venues !== venuesRef.current) {
        const index = new Supercluster({ radius: 50, maxZoom: 17 }).load(
          venuesRef.current.map((v) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [v.longitude, v.latitude] },
            properties: { venueId: v.id },
          }))
        );
        const byId = new Map(venuesRef.current.map((v) => [v.id, v]));
        clusterIndexRef.current = { venues: venuesRef.current, index, byId };
      }
      const { index, byId } = clusterIndexRef.current;
      const visibleIds = visibleVenueIdsRef.current;

      const b = currentMap.getBounds();
      const zoom = Math.floor(currentMap.getZoom());
      const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom);

      const seenKeys = new Set<string>();

      function upsertVenueMarker(map: maplibregl.Map, venue: VenueWithPulse, lng: number, lat: number) {
        const key = `venue:${venue.id}`;
        seenKeys.add(key);

        const cls = mapMarkerClass(venue);
        const isSelected = venue.id === selectedVenueIdRef.current;
        // pulseScore is always a real number, live or baseline-blended (see
        // calculatePulseScore) — shown on every open venue, same as the marker's own
        // color (mapMarkerClass). Only a genuinely CLOSED venue hides it, since a score on
        // a closed dot would look like current activity that can't exist.
        const hideScore = venue.currentPulseStatus === "CLOSED";
        const scoreText = hideScore ? "" : venue.pulse.pulseScore > 0 ? String(venue.pulse.pulseScore) : "–";
        const showRing = cls === "hot";

        const existing = markersMapRef.current.get(key);
        if (existing) {
          existing.setLngLat([lng, lat]);
          const wrapper = existing.getElement();
          const dot = wrapper.querySelector<HTMLDivElement>(".venue-marker");
          if (dot) {
            const nextClass = `venue-marker ${cls}${isSelected ? " selected" : ""}`;
            if (dot.className !== nextClass) dot.className = nextClass;
            if (dot.textContent !== scoreText) dot.textContent = scoreText;
          }
          const existingRing = wrapper.querySelector(".pulse-ring");
          if (showRing && !existingRing) {
            const ring = document.createElement("div");
            ring.className = "pulse-ring";
            wrapper.insertBefore(ring, wrapper.firstChild);
          } else if (!showRing && existingRing) {
            existingRing.remove();
          }
          return;
        }

        const wrapper = document.createElement("div");
        // inline-flex, not the default block: MapLibre re-purposes this element AS its own
        // `.maplibregl-marker` container rather than wrapping it in a new one, and a plain
        // block-level div with no explicit width stretches to fill that marker container's
        // containing block — the full map width (inline-flex, like inline-block, shrinks
        // to fit instead). min-width/min-height plus centering give the CLOSED marker (a
        // deliberately tiny 13px visual dot) a real ~36px clickable footprint without
        // enlarging the dot itself — a 13px CSS-pixel tap target is unusable on a real
        // touchscreen, and closed venues are common on any view where "Open now" is off.
        wrapper.style.position = "relative";
        wrapper.style.display = "inline-flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "center";
        wrapper.style.minWidth = "36px";
        wrapper.style.minHeight = "36px";
        if (showRing) {
          const ring = document.createElement("div");
          ring.className = "pulse-ring";
          wrapper.appendChild(ring);
        }
        const dot = document.createElement("div");
        dot.className = `venue-marker ${cls}${isSelected ? " selected" : ""}`;
        dot.textContent = scoreText;
        wrapper.appendChild(dot);
        wrapper.addEventListener("click", () => onSelectRef.current(venue.id));

        markersMapRef.current.set(key, new maplibregl.Marker({ element: wrapper }).setLngLat([lng, lat]).addTo(map));
      }

      function upsertClusterMarker(map: maplibregl.Map, key: string, lng: number, lat: number, count: number, onClick: () => void) {
        seenKeys.add(key);
        const existing = markersMapRef.current.get(key);
        if (existing) {
          existing.setLngLat([lng, lat]);
          const el = existing.getElement();
          // Unlike before, the displayed count can now change between renders — it's the
          // number of currently-VISIBLE leaves, not the cluster's fixed total membership.
          if (el.textContent !== String(count)) el.textContent = String(count);
          return;
        }

        const size = Math.min(46, 26 + Math.log2(Math.max(2, count)) * 5);
        const el = document.createElement("div");
        el.className = "cluster-marker";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.fontSize = "11.5px";
        el.textContent = String(count);
        el.addEventListener("click", onClick);
        markersMapRef.current.set(key, new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
      }

      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; venueId?: string };

        if (props.cluster) {
          const clusterId = props.cluster_id!;
          // Leaves, not the cluster's own point_count — point_count is the FULL membership
          // regardless of filters, exactly what we can't use here (see the doc comment on
          // `visibleVenueIds`). Cheap at this dataset's scale (bounded by venues in view).
          const leaves = index.getLeaves(clusterId, Infinity) as unknown as Array<{ properties: { venueId: string } }>;
          const visibleLeafIds = leaves.map((l) => l.properties.venueId).filter((id) => visibleIds.has(id));
          if (visibleLeafIds.length === 0) continue;

          if (visibleLeafIds.length === 1) {
            // Down to one visible venue in this cluster — show it as its own marker
            // (at its real coordinates, not the cluster's weighted centroid) rather than a
            // "cluster of 1" bubble.
            const venue = byId.get(visibleLeafIds[0]);
            if (venue) upsertVenueMarker(currentMap, venue, venue.longitude, venue.latitude);
            continue;
          }

          upsertClusterMarker(currentMap, `cluster:${clusterId}`, lng, lat, visibleLeafIds.length, () => {
            currentMap.easeTo({ center: [lng, lat], zoom: Math.min(17, zoom + 2.5) });
          });
          continue;
        }

        if (!props.venueId || !visibleIds.has(props.venueId)) continue;
        const venue = byId.get(props.venueId);
        if (!venue) continue;
        upsertVenueMarker(currentMap, venue, lng, lat);
      }

      for (const [key, marker] of markersMapRef.current) {
        if (!seenKeys.has(key)) {
          marker.remove();
          markersMapRef.current.delete(key);
        }
      }
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracks the last venue a click actually selected — distinct from selectedVenueId
  // itself so the pan below only fires on a genuine new selection, not on every data
  // refresh/poll that happens to leave the same venue selected.
  const lastPannedVenueIdRef = useRef<string | null>(null);

  // Re-render markers whenever the venue list or selection changes (data refresh, filters)
  // — reuses the same marker-drawing logic without re-triggering onBoundsChange.
  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkersRef.current();

    // The bottom sheet covers roughly the lower half of the screen — without this, a
    // venue selected near the bottom edge re-covers itself (and everything else nearby)
    // under its own sheet, making every other marker down there unreachable until the
    // sheet closes. Nudging the selected point up into the clear area above the sheet
    // keeps it (and its neighbors) tappable.
    if (selectedVenueId && selectedVenueId !== lastPannedVenueIdRef.current) {
      const venue = venues.find((v) => v.id === selectedVenueId);
      if (venue) {
        // A flat -170px shift assumes the viewport is tall enough to absorb it — on a
        // short/landscape phone (~375-430px tall), that would land the marker under the
        // fixed search bar/filter row or clip it off the top edge entirely (MapLibre's
        // container clips overflow), the opposite of "keeps it tappable." Clamp the shift
        // so the target never rises above roughly the bottom of the filter row.
        const containerHeight = mapRef.current.getContainer().clientHeight;
        const maxUpwardShift = Math.max(0, containerHeight / 2 - 130);
        const verticalOffset = -Math.min(170, maxUpwardShift);
        mapRef.current.easeTo({ center: [venue.longitude, venue.latitude], offset: [0, verticalOffset], duration: 450 });
      }
    }
    lastPannedVenueIdRef.current = selectedVenueId;
  }, [venues, visibleVenueIds, selectedVenueId]);

  // Inline styles, not just the Tailwind class: MapLibre's own stylesheet sets
  // `.maplibregl-map { position: relative }` on this element once it initializes,
  // which has the same specificity as the Tailwind utility class and loads later —
  // silently collapsing this container to zero height (inset-0 does nothing without
  // position:absolute) and making the map think it needs zero tiles for the viewport.
  // Inline styles always win over class-based rules regardless of load order.
  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {(!isMapReady || !hasDataLoadedOnce) && (
        <div className="map-loading-overlay" aria-hidden="true">
          <span className="map-loading-mark">
            <span className="map-loading-ring" />
            <span className="map-loading-ring delayed" />
            <Radio size={26} color="white" />
          </span>
          <span className="map-loading-wordmark">PULSE</span>
        </div>
      )}
    </>
  );
}
