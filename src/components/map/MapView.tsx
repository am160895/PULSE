"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import { Radio } from "lucide-react";
import type { VenueWithPulse } from "@/types";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from "@/config/constants";
import { markerClassForLabel } from "@/components/venues/Badges";
import type { BoundsParams } from "@/hooks/api";
import { getUserLocationOnce } from "@/lib/geo/userLocation";

interface MapViewProps {
  venues: VenueWithPulse[];
  selectedVenueId: string | null;
  onSelectVenue: (venueId: string) => void;
  onBoundsChange: (bounds: BoundsParams) => void;
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
}

export function MapView({ venues, selectedVenueId, onSelectVenue, onBoundsChange, onUserLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Base map tiles come from an external CDN and MapLibre's own init/worker sequence adds
  // more delay on top — on a slow connection (or this dev sandbox) that can be several
  // seconds of a flat black screen with zero feedback, which reads as "broken," not
  // "loading." True until the style's tiles have actually painted (MapLibre's own "load"
  // event, not just the map object existing).
  const [isMapReady, setIsMapReady] = useState(false);
  // Keyed by a stable id ("venue:<id>" / "cluster:<cluster_id>") so renderMarkers can
  // reconcile in place — update position/class/text on an already-mounted marker — rather
  // than tearing down and recreating every marker on every call. Recreating unconditionally
  // used to make every marker replay its CSS mount animation (marker-in) on every poll
  // refresh, pan, zoom, or selection change, which looked like the whole map "glitching" —
  // markers popping/rescaling in place every few seconds instead of just updating quietly.
  const markersMapRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const venuesRef = useRef(venues);
  const onSelectRef = useRef(onSelectVenue);
  const selectedVenueIdRef = useRef(selectedVenueId);
  const renderMarkersRef = useRef<() => void>(() => {});
  // Supercluster only needs rebuilding when the venue set itself changes, not on every
  // pan/zoom (moveend) or selection change — cache it keyed on the venues array reference.
  const clusterIndexRef = useRef<{ venues: VenueWithPulse[]; index: Supercluster } | null>(null);

  // Keep "latest value" refs in an effect (not during render) so event handlers created
  // once inside the map-init effect below always see current props/state without
  // needing the map itself to be re-created on every prop/state change. selectedVenueId
  // needs this too — renderMarkers is created once in a mount-only effect, so without a
  // ref it would forever compare against the selectedVenueId value from first mount and
  // the "selected" marker highlight would never actually update after a click.
  useEffect(() => {
    venuesRef.current = venues;
    onSelectRef.current = onSelectVenue;
    selectedVenueIdRef.current = selectedVenueId;
  }, [venues, onSelectVenue, selectedVenueId]);

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

      if (clusterIndexRef.current?.venues !== venuesRef.current) {
        const index = new Supercluster({ radius: 50, maxZoom: 17 }).load(
          venuesRef.current.map((v) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [v.longitude, v.latitude] },
            properties: { venueId: v.id },
          }))
        );
        clusterIndexRef.current = { venues: venuesRef.current, index };
      }
      const index = clusterIndexRef.current.index;

      const b = currentMap.getBounds();
      const zoom = Math.floor(currentMap.getZoom());
      const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom);

      const seenKeys = new Set<string>();

      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; venueId?: string };

        if (props.cluster) {
          const key = `cluster:${props.cluster_id}`;
          seenKeys.add(key);
          const existing = markersMapRef.current.get(key);
          if (existing) {
            // A cluster's membership/count never changes for a given cluster_id within
            // the same index — only its screen position can, on pan/zoom.
            existing.setLngLat([lng, lat]);
            continue;
          }

          const size = Math.min(56, 32 + Math.log2(props.point_count ?? 2) * 6);
          const el = document.createElement("div");
          el.className = "cluster-marker";
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.fontSize = "13px";
          el.textContent = String(props.point_count);
          el.addEventListener("click", () => {
            currentMap.easeTo({ center: [lng, lat], zoom: Math.min(17, zoom + 2.5) });
          });
          markersMapRef.current.set(key, new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(currentMap));
          continue;
        }

        const venue = venuesRef.current.find((v) => v.id === props.venueId);
        if (!venue) continue;
        const key = `venue:${venue.id}`;
        seenKeys.add(key);

        const isDirectory = venue.coverageState === "DIRECTORY";
        // A closed venue must never look like it's showing a normal live score (spec
        // §22/§27) — reuses the same plain-dot dim treatment as DIRECTORY rather than
        // inventing a second de-emphasized visual language.
        const isDeemphasized = isDirectory || venue.currentPulseStatus === "CLOSED";
        const cls = isDeemphasized ? "directory" : markerClassForLabel(venue.pulse.pulseLabel);
        const isSelected = venue.id === selectedVenueIdRef.current;
        // A de-emphasized venue (no PULSE data at all, or currently closed) never shows a
        // number here, even "–" — that would still look like a score.
        const scoreText = isDeemphasized ? "" : venue.pulse.pulseScore > 0 ? String(venue.pulse.pulseScore) : "–";
        const showRing = cls === "hot" || cls === "rising";

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
            ring.className = `pulse-ring ${cls === "rising" ? "rising" : ""}`;
            wrapper.insertBefore(ring, wrapper.firstChild);
          } else if (!showRing && existingRing) {
            existingRing.remove();
          } else if (showRing && existingRing) {
            const nextRingClass = `pulse-ring ${cls === "rising" ? "rising" : ""}`;
            if (existingRing.className !== nextRingClass) existingRing.className = nextRingClass;
          }
          continue;
        }

        const wrapper = document.createElement("div");
        // inline-block, not the default block: MapLibre re-purposes this element AS its
        // own `.maplibregl-marker` container rather than wrapping it in a new one, and a
        // plain block-level div with no explicit width stretches to fill that marker
        // container's containing block — the full map width. Harmless for the marker
        // circle itself (it has its own fixed 44px size), but .pulse-ring's `inset: -6px`
        // resolves against WRAPPER's size, not the circle's, so it rendered as a
        // ~1000px-wide glowing oval across the bottom of the map instead of a small ring
        // around one marker. inline-block shrink-wraps to the marker circle's actual
        // size, which fixes both.
        wrapper.style.position = "relative";
        wrapper.style.display = "inline-block";
        if (showRing) {
          const ring = document.createElement("div");
          ring.className = `pulse-ring ${cls === "rising" ? "rising" : ""}`;
          wrapper.appendChild(ring);
        }
        const dot = document.createElement("div");
        dot.className = `venue-marker ${cls}${isSelected ? " selected" : ""}`;
        dot.textContent = scoreText;
        wrapper.appendChild(dot);
        wrapper.addEventListener("click", () => onSelectRef.current(venue.id));

        markersMapRef.current.set(key, new maplibregl.Marker({ element: wrapper }).setLngLat([lng, lat]).addTo(currentMap));
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

  // Re-render markers whenever the venue list or selection changes (data refresh, filters)
  // — reuses the same marker-drawing logic without re-triggering onBoundsChange.
  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkersRef.current();
  }, [venues, selectedVenueId]);

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
      {!isMapReady && (
        <div className="map-loading-overlay" aria-hidden="true">
          <span className="map-loading-mark">
            <Radio size={26} color="white" />
          </span>
          <span className="map-loading-wordmark">PULSE</span>
        </div>
      )}
    </>
  );
}
