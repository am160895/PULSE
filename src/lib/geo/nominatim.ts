// Free OSM geocoder, no API key — used by both the admin bulk-import route and the
// one-off scripts/addRealVenuesBatch*.ts scripts (which import from here rather than
// each carrying their own copy). Nominatim's usage policy requires an honest,
// non-generic User-Agent and caps requests at 1/second — see the caller for the sleep.
export const NOMINATIM_USER_AGENT = "PULSE-nightlife-app/1.0 (venue directory import)";

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A transient 429/503 (or a dropped connection) is NOT the same as "no address match" —
 * conflating them (as an earlier version of this function did, treating every non-ok
 * response as a plain null) silently misreported a burst of rate-limiting as a real
 * geocoding failure across dozens of otherwise-perfectly-valid addresses. Retries a
 * handful of times with backoff before giving up; only a genuine empty result (or a
 * non-retryable 4xx) returns null.
 */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }
      return null;
    }

    if (res.status === 429 || res.status === 503) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }
      return null;
    }

    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
  }

  return null;
}
