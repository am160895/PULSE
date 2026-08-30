import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { FoundingScoutSettings } from "@/components/admin/FoundingScoutSettings";

export default async function AdminFoundingScoutPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div>
      <h1 className="mb-4">Founding Scout</h1>
      <FoundingScoutSettings />
    </div>
  );
}
