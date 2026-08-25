import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import {
  isCloseFriend,
  listAcceptedFriendProfiles,
  listPendingIncoming,
  listPendingOutgoing,
  listVisiblePresenceForViewer,
  toPublicProfile,
} from "@/lib/data/social";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = session.profile.id;
  const [acceptedProfiles, pendingIncoming, pendingOutgoing, presence] = await Promise.all([
    listAcceptedFriendProfiles(profileId),
    listPendingIncoming(profileId),
    listPendingOutgoing(profileId),
    listVisiblePresenceForViewer(profileId),
  ]);

  const friends = await Promise.all(
    acceptedProfiles.map(async (p) => ({ ...toPublicProfile(p), isCloseFriend: await isCloseFriend(profileId, p.id) }))
  );

  return NextResponse.json({
    friends,
    pendingIncoming: pendingIncoming.map((r) => ({ ...r, profile: toPublicProfile(r.profile) })),
    pendingOutgoing: pendingOutgoing.map((r) => ({ ...r, profile: toPublicProfile(r.profile) })),
    presence,
  });
}
