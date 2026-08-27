import Link from "next/link";
import { Radio } from "lucide-react";

/**
 * Shown in place of a page's real content for an anonymous browsing session, on pages
 * that are fundamentally about personal identity/social graph rather than nightlife
 * discovery (you/page.tsx, friends/page.tsx) — rendering the real (zeroed) UI under a
 * "Guest" identity would be confusing, not just empty.
 */
export function AnonymousGate({ next, title, body }: { next: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl mx-auto px-5 py-6 flex flex-col items-center text-center gap-4" style={{ paddingTop: "20vh" }}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--hot)" }}>
        <Radio size={22} color="white" />
      </span>
      <div>
        <h2 className="mb-1.5">{title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-xs">{body}</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="btn btn-primary w-full">
          Sign up
        </Link>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-secondary w-full">
          Log in
        </Link>
      </div>
    </div>
  );
}
