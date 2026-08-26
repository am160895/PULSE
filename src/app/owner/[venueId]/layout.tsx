import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/auth";

/**
 * Second, independent check of the same VERIFIED-ownership membership set the API route
 * checks — a page-level redirect here isn't the real security boundary (the API route is),
 * but it stops an owner from ever seeing another venue's dashboard shell render even for
 * an instant while the API call resolves.
 */
export default async function OwnerVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}) {
  const owner = await getOwnerSession();
  if (!owner) redirect("/map");

  const { venueId } = await params;
  if (!owner.ownedVenueIds.has(venueId)) redirect("/owner");

  return <>{children}</>;
}
