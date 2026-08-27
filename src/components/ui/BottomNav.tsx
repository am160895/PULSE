"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, User, Users } from "lucide-react";

const ITEMS = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/you", label: "You", icon: User },
];

export function BottomNav({ isAnonymous }: { isAnonymous: boolean }) {
  const pathname = usePathname();

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
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
