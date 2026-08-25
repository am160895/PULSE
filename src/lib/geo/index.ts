const EARTH_RADIUS_METERS = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters. Local-dev stand-in for PostGIS ST_Distance. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(a: LatLng, b: LatLng, radiusMeters: number): boolean {
  return haversineDistanceMeters(a, b) <= radiusMeters;
}

export function isWithinBoundingBox(point: LatLng, box: BoundingBox): boolean {
  return (
    point.lat <= box.north &&
    point.lat >= box.south &&
    point.lng <= box.east &&
    point.lng >= box.west
  );
}

export function boundingBoxFromCenter(center: LatLng, radiusMeters: number): BoundingBox {
  // Small-area approximation, fine for a single-borough launch map.
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos(toRadians(center.lat)));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 160) return "a few steps away";
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters)} m away`;
  return `${miles.toFixed(1)} mi away`;
}

/** Deterministic pseudo-random point within radiusMeters of center, seeded by index. */
export function seededPointNear(center: LatLng, radiusMeters: number, seed: number): LatLng {
  const angle = (seed * 137.5) % 360;
  const rand = mulberry32(seed);
  const distance = rand() * radiusMeters;
  const rad = toRadians(angle);
  const latDelta = (distance * Math.cos(rad)) / 111_320;
  const lngDelta = (distance * Math.sin(rad)) / (111_320 * Math.cos(toRadians(center.lat)));
  return { lat: center.lat + latDelta, lng: center.lng + lngDelta };
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
