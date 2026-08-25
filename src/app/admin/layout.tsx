import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, MapPin, Users } from "lucide-react";
import { getAdminSession } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already requires *some* valid session to reach /admin at all; this is the
  // second layer that actually checks the role, exactly like every /api/admin/** route.
  const session = await getAdminSession();
  if (!session) redirect("/map");

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] p-4 flex flex-col gap-1">
        <div className="font-bold text-[15px] px-2 mb-4">PULSE Admin</div>
        <AdminNavLink href="/admin" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <AdminNavLink href="/admin/venues" icon={<MapPin size={16} />} label="Venues" />
        <AdminNavLink href="/admin/users" icon={<Users size={16} />} label="Users" />
        <div className="mt-auto pt-4 px-2 text-[12px] text-[var(--text-muted)]">
          {session.profile.displayName}
          <br />
          <Link href="/map" className="underline">
            Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 px-8 py-6 max-w-5xl">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="admin-nav-item">
      {icon}
      {label}
    </Link>
  );
}
