import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { listAllProfilesForAdmin } from "@/lib/data/social";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  return NextResponse.json({ users: await listAllProfilesForAdmin() });
}
