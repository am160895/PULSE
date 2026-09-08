import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { listActivePerks, listRedemptionsForUser } from "@/lib/data/perks";
import { getUserProgress } from "@/lib/data/gamification";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [perks, redemptions, progress] = await Promise.all([
    listActivePerks(),
    listRedemptionsForUser(session.profile.id),
    getUserProgress(session.profile.id),
  ]);
  const redeemedPerkIds = new Set(redemptions.map((r) => r.perkId));

  const eligible = perks.filter((p) => progress.totalXp >= p.requiredMinXp && !redeemedPerkIds.has(p.id));
  return NextResponse.json({ perks: eligible });
}
