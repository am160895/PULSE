import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { AnonymousGate } from "@/components/ui/AnonymousGate";
import { FriendsView } from "@/components/friends/FriendsView";

export default async function FriendsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.isAnonymous) {
    return <AnonymousGate next="/friends" title="See who's out tonight" body="Create an account to add friends and see when they're nearby." />;
  }

  return <FriendsView />;
}
