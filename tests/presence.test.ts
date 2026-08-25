import { describe, expect, it } from "vitest";
import { canViewPresence } from "@/lib/presence/visibility";

const now = new Date("2026-01-02T23:00:00-05:00");
const future = new Date(now.getTime() + 60 * 60_000);
const past = new Date(now.getTime() - 60 * 60_000);

const base = {
  viewerId: "viewer",
  ownerId: "owner",
  expiresAt: future,
  now,
  viewerIsCloseFriendOfOwner: false,
};

describe("canViewPresence", () => {
  it("lets the owner always see their own presence", () => {
    expect(canViewPresence({ ...base, viewerId: "owner", visibility: "PRIVATE", friendshipStatus: null })).toBe(true);
  });

  it("hides PRIVATE presence from everyone else, even accepted friends", () => {
    expect(canViewPresence({ ...base, visibility: "PRIVATE", friendshipStatus: "ACCEPTED" })).toBe(false);
  });

  it("shows FRIENDS-visibility presence to accepted friends", () => {
    expect(canViewPresence({ ...base, visibility: "FRIENDS", friendshipStatus: "ACCEPTED" })).toBe(true);
  });

  it("hides FRIENDS-visibility presence from a stranger with no relationship", () => {
    expect(canViewPresence({ ...base, visibility: "FRIENDS", friendshipStatus: null })).toBe(false);
  });

  it("hides FRIENDS-visibility presence from a pending (not yet accepted) request", () => {
    expect(canViewPresence({ ...base, visibility: "FRIENDS", friendshipStatus: "PENDING" })).toBe(false);
  });

  it("hides presence from a blocked relationship regardless of visibility", () => {
    expect(canViewPresence({ ...base, visibility: "FRIENDS", friendshipStatus: "BLOCKED" })).toBe(false);
  });

  it("shows CLOSE_FRIENDS presence only to designated close friends", () => {
    expect(canViewPresence({ ...base, visibility: "CLOSE_FRIENDS", friendshipStatus: "ACCEPTED", viewerIsCloseFriendOfOwner: false })).toBe(false);
    expect(canViewPresence({ ...base, visibility: "CLOSE_FRIENDS", friendshipStatus: "ACCEPTED", viewerIsCloseFriendOfOwner: true })).toBe(true);
  });

  it("hides presence once it has expired", () => {
    expect(canViewPresence({ ...base, visibility: "FRIENDS", friendshipStatus: "ACCEPTED", expiresAt: past })).toBe(false);
  });
});
