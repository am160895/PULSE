import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { getProfileById, setProfileRole } from "@/lib/data/social";

const schema = z.object({ role: z.enum(["USER", "ADMIN"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  // An admin can't change their own role through this endpoint — prevents a misclick
  // (or a compromised session) from locking every admin out of the panel at once. A
  // second admin, or the INITIAL_ADMIN_EMAIL bootstrap, is required to change it instead.
  if (id === session.profile.id) {
    return NextResponse.json({ error: "You can't change your own role — ask another admin to do it." }, { status: 400 });
  }

  if (!(await getProfileById(id))) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const profile = await setProfileRole(id, parsed.data.role);
  return NextResponse.json({ ok: true, profile });
}
