import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Shield } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { LogoutButton } from "@/components/ui/LogoutButton";

export default async function YouPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-6">You</h1>

      <div className="flex items-center gap-3 mb-6">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold"
          style={{ background: "var(--surface-2)" }}
        >
          {session.profile.displayName.charAt(0)}
        </div>
        <div>
          <p className="font-semibold">{session.profile.displayName}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">@{session.profile.username} · {session.profile.homeCity}</p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] mb-6">
        <SettingsLink href="/settings/privacy" icon={<Shield size={16} />} label="Privacy" />
        <SettingsLink href="/settings/notifications" icon={<Bell size={16} />} label="Notifications" />
      </div>

      <LogoutButton />
    </div>
  );
}

function SettingsLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      <ChevronRight size={16} color="var(--text-muted)" />
    </Link>
  );
}
