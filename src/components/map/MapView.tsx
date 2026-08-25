"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import type { VenueWithPulse } from "@/types";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from "@/config/constants";
import { markerClassForLabel } from "@/components/venues/Badges";
import type { BoundsParams } from "@/hooks/api";

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
  const markersRef = useRef<maplibregl.Marker[]>([]);
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

    map.on("load", emitBounds);
    map.on("moveend", emitBounds);
    renderMarkersRef.current = renderMarkers;

    // getBounds()/getZoom() are synchronously valid right after construction — don't
    // make the first render of markers wait on the `load` event, which fires on a
    // requestAnimationFrame callback and can be delayed by the browser (backgrounded
    // tabs throttle rAF entirely). `load`/`moveend` still handle every update after this.
    emitBounds();

    if (onUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 4000 }
      );
    }

    function renderMarkers() {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

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

      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as { cluster?: boolean; point_count?: number; venueId?: string };

        const el = document.createElement("div");

        if (props.cluster) {
          const size = Math.min(56, 32 + Math.log2(props.point_count ?? 2) * 6);
          el.className = "cluster-marker";
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.fontSize = "13px";
          el.textContent = String(props.point_count);
          el.addEventListener("click", () => {
            currentMap.easeTo({ center: [lng, lat], zoom: Math.min(17, zoom + 2.5) });
          });
        } else {
          const venue = venuesRef.current.find((v) => v.id === props.venueId);
          if (!venue) continue;
          const isDirectory = venue.coverageState === "DIRECTORY";
          const cls = isDirectory ? "directory" : markerClassForLabel(venue.pulse.pulseLabel);
          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          if (cls === "hot" || cls === "rising") {
            const ring = document.createElement("div");
            ring.className = `pulse-ring ${cls === "rising" ? "rising" : ""}`;
            wrapper.appendChild(ring);
          }
          el.className = `venue-marker ${cls}${venue.id === selectedVenueIdRef.current ? " selected" : ""}`;
          // A DIRECTORY venue has no PULSE data at all — showing any number here, even "–",
          // would look like a score. It gets a plain dot (see .venue-marker.directory) instead.
          el.textContent = isDirectory ? "" : venue.pulse.pulseScore > 0 ? String(venue.pulse.pulseScore) : "–";
          wrapper.appendChild(el);
          wrapper.addEventListener("click", () => onSelectRef.current(venue.id));

          markersRef.current.push(new maplibregl.Marker({ element: wrapper }).setLngLat([lng, lat]).addTo(currentMap));
          continue;
        }

        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(currentMap));
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
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
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    />
  );
}
