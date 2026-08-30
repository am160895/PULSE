import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { BottomNav } from "@/components/ui/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const isAdmin = session.profile.role === "ADMIN";
  // The Sign up pill floats above the bottom nav (see BottomNav), which the base pb-16
  // only clears for the nav itself — on a normal-flow page (venue detail, you) that extra
  // floating pill can otherwise land right on top of scrolled content, permanently hiding
  // whatever happens to end up under it. Only reserve the extra space when it actually
  // renders (anonymous sessions only — an admin's Profile tab links straight to /admin now,
  // so there's no separate floating admin pill to clear).
  const hasFloatingPill = session.isAnonymous;

  return (
    <div className={`min-h-screen ${hasFloatingPill ? "pb-28" : "pb-16"}`}>
      {children}
      <BottomNav isAnonymous={session.isAnonymous} isAdmin={isAdmin} />
    </div>
  );
}
