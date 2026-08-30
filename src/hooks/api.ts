"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BadgeCode, ConfirmedSignal, PulseResult, Venue, VenueNightlyRollup, VenueOwnerStatus, VenueWithPulse, VsTypicalComparison } from "@/types";
import { MAP_REFRESH_MS, VENUE_DETAIL_REFRESH_MS } from "@/config/constants";
import type { ExploreSection } from "@/lib/pulse/explore";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  return res.json();
}

export interface BoundsParams {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function useVenuesInBounds(bounds: BoundsParams | null, userLocation: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ["venues", bounds, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bounds) {
        params.set("north", String(bounds.north));
        params.set("south", String(bounds.south));
        params.set("east", String(bounds.east));
        params.set("west", String(bounds.west));
      }
      if (userLocation) {
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
      }
      const data = await fetchJson<{ venues: VenueWithPulse[] }>(`/api/venues?${params}`);
      return data.venues;
    },
    enabled: !!bounds,
    refetchInterval: MAP_REFRESH_MS,
    // Every pan/zoom changes `bounds`, which is part of the query key — without this,
    // React Query treats it as a brand-new query and `data` goes undefined while it
    // fetches, so the map flashes empty (very visible at ~4-5s response times) until
    // the new bounds' venues load. Keep showing the last-known venues in the meantime.
    placeholderData: keepPreviousData,
  });
}

export function useVenueSearch(query: string) {
  return useQuery({
    queryKey: ["venue-search", query],
    queryFn: async () => {
      const data = await fetchJson<{ venues: VenueWithPulse[] }>(`/api/venues?q=${encodeURIComponent(query)}`);
      return data.venues;
    },
    enabled: query.trim().length > 0,
  });
}

export function useVenue(id: string) {
  return useQuery({
    queryKey: ["venue", id],
    queryFn: () =>
      fetchJson<{
        venue: VenueWithPulse;
        alternatives: VenueWithPulse[];
        newlyConfirmedSignals: ConfirmedSignal[];
        newlyUnlockedBadges: Array<{ code: BadgeCode; neighborhood: string; xpEventId: string | null }>;
        myOwnershipStatus: VenueOwnerStatus | null;
      }>(`/api/venues/${id}`),
    refetchInterval: VENUE_DETAIL_REFRESH_MS,
  });
}

export interface HistoryPoint {
  time: string;
  /** Absent for forecast points — the real observed score, only ever known for the past. */
  actual?: number;
  /** The historical-baseline projection for this exact time, plotted across the whole
   * range (past included) so it visibly overlaps "actual" until a real report diverges it. */
  typical: number;
}

export function useVenueHistory(id: string) {
  return useQuery({
    queryKey: ["venue-history", id],
    queryFn: () => fetchJson<{ past: HistoryPoint[]; forecast: HistoryPoint[] }>(`/api/venues/${id}/history`),
    refetchInterval: VENUE_DETAIL_REFRESH_MS,
  });
}

export function useExplore(userLocation: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ["explore", userLocation],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userLocation) {
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
      }
      const data = await fetchJson<{ sections: ExploreSection[] }>(`/api/explore?${params}`);
      return data.sections;
    },
    refetchInterval: MAP_REFRESH_MS,
  });
}

export interface FriendsResponse {
  friends: { id: string; displayName: string; username: string; avatarUrl: string | null; isCloseFriend: boolean }[];
  pendingIncoming: { friendshipId: string; profile: { id: string; displayName: string; username: string }; createdAt: string }[];
  pendingOutgoing: { friendshipId: string; profile: { id: string; displayName: string; username: string }; createdAt: string }[];
  presence: { profileId: string; displayName: string; status: string; venueId: string | null; venueName: string | null; startedAt: string }[];
}

export function useSavedVenues() {
  return useQuery({
    queryKey: ["saved"],
    queryFn: async () => (await fetchJson<{ venues: VenueWithPulse[] }>("/api/saved")).venues,
  });
}

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: () => fetchJson<FriendsResponse>("/api/friends"),
    refetchInterval: MAP_REFRESH_MS,
  });
}

export interface NeighborhoodBenchmark {
  averageScore: number;
  venueCount: number;
}

export interface OwnerDashboardData {
  venue: Venue;
  currentPulse: PulseResult;
  vsTypical: VsTypicalComparison | null;
  recentRollups: VenueNightlyRollup[];
  neighborhoodBenchmark: NeighborhoodBenchmark | null;
}

export function useOwnerDashboard(venueId: string) {
  return useQuery({
    queryKey: ["owner-dashboard", venueId],
    queryFn: () => fetchJson<OwnerDashboardData>(`/api/owner/venues/${venueId}/dashboard`),
    refetchInterval: VENUE_DETAIL_REFRESH_MS,
  });
}

export function useInvalidateVenue() {
  const client = useQueryClient();
  return (venueId: string) => {
    client.invalidateQueries({ queryKey: ["venue", venueId] });
    client.invalidateQueries({ queryKey: ["venues"] });
    client.invalidateQueries({ queryKey: ["explore"] });
  };
}
