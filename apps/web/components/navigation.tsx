"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/assets", label: "Assets" },
  { href: "/transfers", label: "Transfers" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/sync-batches", label: "Sync Batches" }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex flex-wrap gap-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`app-nav-link ${pathname === link.href ? "app-nav-link-active" : ""}`}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
