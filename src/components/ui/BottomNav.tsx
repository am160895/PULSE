"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Map, User } from "lucide-react";

const BASE_ITEMS = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/directory", label: "Directory", icon: BookOpen },
];

export function BottomNav({ isAnonymous, isAdmin }: { isAnonymous: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  // For an admin, Profile IS the admin dashboard — no separate floating admin shortcut
  // needed on top of it (that used to double as a fixed pill that could cover page
  // content — see AppLayout's hasFloatingPill).
  const items = [...BASE_ITEMS, { href: isAdmin ? "/admin" : "/you", label: "Profile", icon: User }];

  return (
    <>
      {isAnonymous && (
        <Link
          href={`/signup?next=${encodeURIComponent(pathname)}`}
          className="btn btn-primary"
          style={{ position: "fixed", right: 12, bottom: 76, zIndex: 30, height: 34, padding: "0 14px", fontSize: 13 }}
        >
          Sign up
        </Link>
      )}
      <nav className="bottom-nav">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={label} href={href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
