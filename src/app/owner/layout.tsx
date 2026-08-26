import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import { getOwnerSession } from "@/lib/auth";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerSession();
  if (!owner) redirect("/map");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2 font-bold text-[15px]">
          <Radio size={18} color="var(--accent)" />
          PULSE for Owners
        </div>
        <Link href="/map" className="text-[13px] underline text-[var(--text-secondary)]">
          Back to app
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-6 pb-10">{children}</main>
    </div>
  );
}
