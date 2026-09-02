"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/config/constants";

// Real coordinates in the neighborhoods PULSE actually covers, positioned by projecting
// onto the real map below rather than floating over a fake grid, so they land on the
// actual streets/blocks they claim to. Deliberately carries NO score number and NO
// pulse-ring animation — those are exactly what the real, authenticated map uses to mean
// "a genuine live reading," and a logged-out visitor has no way to know these are purely
// decorative. Plain colored dots read as ambient texture, not as fabricated live data,
// which matters more than looking busy: this page's copy already claims the real product
// is real-time, and a fake "94, live, pulsing" reading right next to that claim would be
// the exact kind of trust-breaking lie the rest of the app goes out of its way to avoid.
const SHOWCASE_POINTS: { lng: number; lat: number; color: string }[] = [
  { lng: -74.0067, lat: 40.7333, color: "var(--active)" }, // West Village
  { lng: -73.9855, lat: 40.7209, color: "var(--irish)" }, // Lower East Side
  { lng: -74.0021, lat: 40.7233, color: "var(--active)" }, // SoHo
  { lng: -73.9925, lat: 40.7265, color: "var(--accent)" }, // NoHo
  { lng: -74.0048, lat: 40.7359, color: "var(--active)" }, // Greenwich Village
  { lng: -74.0014, lat: 40.7421, color: "var(--irish)" }, // Chelsea
];

const CENTER: [number, number] = [-73.999, 40.729];
const ZOOM = 13.3;

/** A real, non-interactive Manhattan map (same free CARTO tiles the in-app map uses) as
 * the landing page's hero visual, with a handful of plain decorative dots projected onto
 * their real neighborhoods — ambient texture only, never styled to look like a live
 * reading (see the note on SHOWCASE_POINTS above). */
export function LandingMapBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number; color: string }[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // See MapView.tsx for why this explicit worker URL is required under Turbopack.
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: CENTER,
      zoom: ZOOM,
      interactive: false, // decorative only — no pan/zoom/click on the landing page
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    function placePoints() {
      setPoints(SHOWCASE_POINTS.map((p) => ({ ...map.project([p.lng, p.lat]), color: p.color })));
    }

    map.on("load", placePoints);
    const resizeObserver = new ResizeObserver(placePoints);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-md)]" style={{ background: "#0e1116" }}>
      <div ref={containerRef} className="absolute inset-0" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      {points.map((d, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: d.x,
            top: d.y,
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            background: d.color,
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.5)",
          }}
        />
      ))}
    </div>
  );
}
