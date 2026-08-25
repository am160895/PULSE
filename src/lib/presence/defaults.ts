import type { PresencePreferences } from "@/types";
import { PRESENCE_DEFAULT_TIMEOUT_MINUTES } from "@/config/constants";

export function defaultPresencePreferences(userId: string, now: string): PresencePreferences {
  return {
    userId,
    defaultVisibility: "PRIVATE",
    allowVenuePresence: false,
    allowNearbyPresence: false,
    allowRecentPresence: false,
    presenceTimeoutMinutes: PRESENCE_DEFAULT_TIMEOUT_MINUTES,
    updatedAt: now,
  };
}
