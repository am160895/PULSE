import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div>
      <h1 className="mb-4">Users</h1>
      <UsersTable currentUserId={session.profile.id} />
    </div>
  );
}
