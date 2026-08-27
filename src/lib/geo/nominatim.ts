// Free OSM geocoder, no API key — used by both the admin bulk-import route and the
// one-off scripts/addRealVenuesBatch*.ts scripts (which import from here rather than
// each carrying their own copy). Nominatim's usage policy requires an honest,
// non-generic User-Agent and caps requests at 1/second — see the caller for the sleep.
export const NOMINATIM_USER_AGENT = "PULSE-nightlife-app/1.0 (venue directory import)";

export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}
