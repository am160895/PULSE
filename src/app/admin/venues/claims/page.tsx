import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { ClaimsTable } from "@/components/admin/ClaimsTable";

export default async function AdminVenueClaimsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div>
      <h1 className="mb-4">Venue claims</h1>
      <ClaimsTable />
    </div>
  );
}
