import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";

export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-10">
      <Link href="/you" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] mb-4">
        <ArrowLeft size={14} /> You
      </Link>
      <h1 className="mb-1">Notifications</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">
        PULSE is in-app only for now — there&apos;s no push or email notification system yet, so there&apos;s nothing
        to toggle here that would actually do anything.
      </p>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)]">
          <Bell size={16} />
          <span className="text-[13px] font-medium">Planned</span>
        </div>
        <ul className="text-[13px] text-[var(--text-secondary)] flex flex-col gap-1.5 list-disc pl-4">
          <li>Daily digest: &quot;18 places worth checking out tonight&quot;</li>
          <li>A saved venue starts rising fast</li>
          <li>A friend goes live nearby</li>
        </ul>
      </div>
    </div>
  );
}
