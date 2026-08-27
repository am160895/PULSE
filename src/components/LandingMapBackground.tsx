"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/config/constants";

// Real coordinates in the neighborhoods PULSE actually covers — purely decorative here
// (the landing page renders before login, so there's no live pulse data to show yet), not
// fetched from the API. Positioned by projecting these onto the real map below rather than
// floating over a fake grid, so they land on the actual streets/blocks they claim to.
const SHOWCASE_POINTS: { lng: number; lat: number; score: number; cls: string }[] = [
  { lng: -74.0067, lat: 40.7333, score: 94, cls: "hot" }, // West Village
  { lng: -73.9855, lat: 40.7209, score: 81, cls: "rising" }, // Lower East Side
  { lng: -74.0021, lat: 40.7233, score: 72, cls: "active" }, // SoHo
  { lng: -73.9925, lat: 40.7265, score: 45, cls: "moderate" }, // NoHo
  { lng: -74.0048, lat: 40.7359, score: 28, cls: "quiet" }, // Greenwich Village
  { lng: -74.0014, lat: 40.7421, score: 88, cls: "hot" }, // Chelsea
];

const CENTER: [number, number] = [-73.999, 40.729];
const ZOOM = 13.3;

/** A real, non-interactive Manhattan map (same free CARTO tiles the in-app map uses) as
 * the landing page's hero visual, with a handful of decorative pulse markers projected
 * onto their real neighborhoods — replaces the old fake abstract grid+dots placeholder. */
export function LandingMapBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number; score: number; cls: string }[]>([]);

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
      setPoints(SHOWCASE_POINTS.map((p) => ({ ...map.project([p.lng, p.lat]), score: p.score, cls: p.cls })));
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
        <div key={i} className="absolute pointer-events-none" style={{ left: d.x, top: d.y, transform: "translate(-50%, -50%)" }}>
          {d.cls === "hot" && <div className="pulse-ring" />}
          <div className={`venue-marker ${d.cls}`} style={{ width: 40, height: 40, fontSize: 12 }}>
            {d.score}
          </div>
        </div>
      ))}
    </div>
  );
}
