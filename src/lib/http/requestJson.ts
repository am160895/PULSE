export type RequestResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * fetch() only rejects on network-level failure, not on HTTP error status — and a bare
 * `await fetch(...)` with no try/catch turns an offline/DNS failure into an unhandled
 * promise rejection with zero user feedback. This is the one place that distinction gets
 * handled, so call sites can't silently treat a failed request as a success.
 */
export async function requestJson<T = unknown>(
  url: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }
): Promise<RequestResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string })?.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Network error — check your connection and try again." };
  }
}
