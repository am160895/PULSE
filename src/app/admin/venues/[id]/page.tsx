import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getVenueById } from "@/lib/data/repository";
import { VenueForm } from "@/components/admin/VenueForm";

export default async function EditVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) notFound();

  return (
    <div>
      <Link href="/admin/venues" className="admin-nav-item mb-4 inline-flex w-auto px-0">
        <ArrowLeft size={16} /> Back to venues
      </Link>
      <h1 className="mb-6">{venue.name}</h1>
      <VenueForm venue={venue} />
    </div>
  );
}
