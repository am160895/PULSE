"use client";

export interface UserLocation {
  lat: number;
  lng: number;
}

// Module-level, not component state: the map, Explore, and every report submission each
// used to call navigator.geolocation.getCurrentPosition() independently, with nothing
// shared between them — every screen transition (and every single report) re-asked the
// browser/OS for a location fix. A shared cache plus a de-duped in-flight promise means
// the whole app requests it at most once per page session; every caller after the first
// gets the same cached result instantly instead of triggering another location lookup.
let cached: UserLocation | null = null;
let inFlight: Promise<UserLocation | null> | null = null;

export function getUserLocationOnce(timeoutMs = 4000): Promise<UserLocation | null> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);

  inFlight = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        inFlight = null;
        resolve(cached);
      },
      () => {
        inFlight = null;
        resolve(null);
      },
      { timeout: timeoutMs }
    );
  });
  return inFlight;
}
