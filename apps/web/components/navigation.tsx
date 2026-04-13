import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/assets", label: "Assets" },
  { href: "/transfers", label: "Transfers" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/sync-batches", label: "Sync Batches" }
];

export function Navigation() {
  return (
    <nav className="mt-4 flex flex-wrap gap-4 text-sm">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="rounded border border-line px-3 py-1.5">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}