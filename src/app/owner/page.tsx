import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnerSession } from "@/lib/auth";
import { getVenuesByIds } from "@/lib/data/repository";

export default async function OwnerVenuesPage() {
  const owner = await getOwnerSession();
  if (!owner) redirect("/map");

  const venues = await getVenuesByIds([...owner.ownedVenueIds]);

  return (
    <div>
      <h1 className="mb-4">Your venues</h1>
      {venues.length === 0 ? (
        <p className="text-[14px] text-[var(--text-secondary)]">
          No verified venues yet. Claim a venue from its page in the app, then wait for admin approval.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {venues.map((v) => (
            <Link
              key={v.id}
              href={`/owner/${v.id}`}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
            >
              <div>
                <p className="font-medium text-[14px]">{v.name}</p>
                <p className="text-[12px] text-[var(--text-secondary)]">{v.neighborhood}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
