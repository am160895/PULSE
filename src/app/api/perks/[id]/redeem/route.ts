import { NextResponse } from "next/server";
import { anonymousSessionError, getCurrentSession } from "@/lib/auth";
import { insertRedemption, listActivePerks } from "@/lib/data/perks";
import { getUserProgress } from "@/lib/data/gamification";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isAnonymous) return anonymousSessionError();

  const { id } = await params;

  // Re-checked server-side, not just trusted from the client's earlier GET /api/perks —
  // XP could have changed, or the perk could have been deactivated, since that list loaded.
  const [perks, progress] = await Promise.all([listActivePerks(), getUserProgress(session.profile.id)]);
  const perk = perks.find((p) => p.id === id);
  if (!perk) return NextResponse.json({ error: "Perk not found or no longer active" }, { status: 404 });
  if (progress.totalXp < perk.requiredMinXp) {
    return NextResponse.json({ error: "You haven't reached the XP required for this perk yet" }, { status: 403 });
  }

  const redemption = await insertRedemption(perk.id, session.profile.id);
  if (!redemption) return NextResponse.json({ error: "You've already redeemed this perk" }, { status: 409 });

  return NextResponse.json({ ok: true, redemption });
}
