import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { listOwnershipRequestsForAdmin } from "@/lib/data/ownership";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const requests = await listOwnershipRequestsForAdmin();
  return NextResponse.json({ requests });
}
