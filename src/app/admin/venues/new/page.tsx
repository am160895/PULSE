import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VenueForm } from "@/components/admin/VenueForm";

export default function NewVenuePage() {
  return (
    <div>
      <Link href="/admin/venues" className="admin-nav-item mb-4 inline-flex w-auto px-0">
        <ArrowLeft size={16} /> Back to venues
      </Link>
      <h1 className="mb-6">New venue</h1>
      <VenueForm />
    </div>
  );
}
