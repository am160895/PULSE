import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { PerksAdmin } from "@/components/admin/PerksAdmin";

export default async function AdminPerksPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div>
      <h1 className="mb-4">Perks</h1>
      <PerksAdmin />
    </div>
  );
}
