"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { VenueWithPulse } from "@/types";
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

export type CoverageMode = "NOW" | "ALL";

export function useVenuesInBounds(
  bounds: BoundsParams | null,
  userLocation: { lat: number; lng: number } | null,
  coverage: CoverageMode = "NOW"
) {
  return useQuery({
    queryKey: ["venues", bounds, userLocation, coverage],
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
      params.set("coverage", coverage);
      const data = await fetchJson<{ venues: VenueWithPulse[] }>(`/api/venues?${params}`);
      return data.venues;
    },
    enabled: !!bounds,
    refetchInterval: MAP_REFRESH_MS,
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
    queryFn: () => fetchJson<{ venue: VenueWithPulse; alternatives: VenueWithPulse[] }>(`/api/venues/${id}`),
    refetchInterval: VENUE_DETAIL_REFRESH_MS,
  });
}

export interface HistoryPoint {
  time: string;
  score: number;
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

export function useInvalidateVenue() {
  const client = useQueryClient();
  return (venueId: string) => {
    client.invalidateQueries({ queryKey: ["venue", venueId] });
    client.invalidateQueries({ queryKey: ["venues"] });
    client.invalidateQueries({ queryKey: ["explore"] });
  };
}
