import { formatCodeLabel } from "../lib/format";

type Severity = "low" | "medium" | "high" | "open" | "resolved" | "healthy" | "stale" | string;

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function StatusBadge({ value }: { value: Severity }) {
  const style = {
    high: "border-critical/80 text-critical",
    medium: "border-warning/80 text-warning",
    low: "border-sky-400/80 text-sky-300",
    open: "border-warning/80 text-warning",
    resolved: "border-success/80 text-success",
    healthy: "border-success/80 text-success",
    stale: "border-critical/80 text-critical",
    in_transit: "border-sky-400/80 text-sky-300",
    under_inspection: "border-warning/80 text-warning",
    reconciliation_required: "border-critical/80 text-critical",
    at_site: "border-success/80 text-success",
    initiated: "border-sky-400/80 text-sky-300",
    started: "border-warning/80 text-warning",
    completed: "border-success/80 text-success"
  }[value];

  return (
    <span className={cx("whitespace-nowrap rounded border px-2 py-0.5 text-xs uppercase tracking-wide", style ?? "border-line text-fgMuted")}>
      {formatCodeLabel(value)}
    </span>
  );
}
