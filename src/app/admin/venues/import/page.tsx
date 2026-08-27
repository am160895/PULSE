import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { VenueImportForm } from "@/components/admin/VenueImportForm";

export default async function AdminVenueImportPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div>
      <h1 className="mb-4">Import venues</h1>
      <VenueImportForm />
    </div>
  );
}
