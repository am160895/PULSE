import type { AnalyticsEventName } from "@/types";

/**
 * Fire-and-forget funnel tracking — call sites never await this (an analytics call must
 * never delay or fail the action it's measuring, same convention as sendWelcomeEmail).
 * keepalive lets the request survive a navigation started right after (e.g. clicking
 * "Explore NYC live" fires LANDING_VIEW... this call... then immediately navigates).
 */
export function trackEvent(event: AnalyticsEventName, venueId?: string): void {
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, venueId }),
    keepalive: true,
  }).catch(() => {
    // best-effort — a lost analytics event is never worth surfacing to the user
  });
}
