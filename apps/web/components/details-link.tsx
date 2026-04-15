import Link from "next/link";

export function DetailsLink({
  href,
  label = "Select"
}: {
  href: string;
  label?: string;
}) {
  const selected = label.toLowerCase() === "selected";
  return (
    <Link
      href={href}
      className={`app-pill-action ${selected ? "app-pill-action-selected" : ""}`}
      aria-label={label}
    >
      {label}
    </Link>
  );
}
