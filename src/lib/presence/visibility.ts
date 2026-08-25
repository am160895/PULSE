import type { FriendshipStatus, Visibility } from "@/types";

export interface PresenceVisibilityInput {
  viewerId: string;
  ownerId: string;
  visibility: Visibility;
  expiresAt: Date;
  now: Date;
  friendshipStatus: FriendshipStatus | null; // null = no relationship on file
  viewerIsCloseFriendOfOwner: boolean;
}

/**
 * The single choke point every presence read goes through. Deliberately conservative:
 * anything ambiguous (no relationship, expired, blocked) resolves to false.
 */
export function canViewPresence(input: PresenceVisibilityInput): boolean {
  if (input.viewerId === input.ownerId) return true;
  if (input.now.getTime() >= input.expiresAt.getTime()) return false;
  if (input.friendshipStatus !== "ACCEPTED") return false; // covers null, PENDING, and BLOCKED

  switch (input.visibility) {
    case "PRIVATE":
      return false;
    case "FRIENDS":
      return true;
    case "CLOSE_FRIENDS":
      return input.viewerIsCloseFriendOfOwner;
    default:
      return false;
  }
}
