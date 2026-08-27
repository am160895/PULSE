import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { BottomNav } from "@/components/ui/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav isAnonymous={session.isAnonymous} />
    </div>
  );
}
