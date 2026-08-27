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
// Distinct from `cached` — set on ANY resolved outcome (success, denial, or timeout), not
// just success. Without this, a slow response (the browser's permission dialog can easily
// take longer than a few seconds for a person to actually read and click) hits our own
// internal timeout first, resolves null, and the NEXT call site (map load right into
// Explore's own lookup, or a report submitted moments later) sees no cache and asks again
// — a second prompt stacking on a first one the person hadn't even answered yet. Once
// `attempted` is true, every future call in this page session gets the same answer,
// instantly, with no further browser prompt — that's the actual point of "only once."
let attempted = false;
let inFlight: Promise<UserLocation | null> | null = null;

export function getUserLocationOnce(timeoutMs = 8000): Promise<UserLocation | null> {
  if (attempted) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    attempted = true;
    return Promise.resolve(null);
  }

  inFlight = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        attempted = true;
        inFlight = null;
        resolve(cached);
      },
      () => {
        attempted = true;
        inFlight = null;
        resolve(null);
      },
      // maximumAge lets the browser hand back a recently-acquired OS-level fix instead of
      // forcing a brand new one — makes a granted permission resolve faster, it doesn't
      // affect whether/how the prompt itself appears.
      { timeout: timeoutMs, maximumAge: 300_000 }
    );
  });
  return inFlight;
}
