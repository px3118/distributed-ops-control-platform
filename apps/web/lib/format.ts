const labelOverrides: Record<string, string> = {
  at_site: "At Site",
  in_transit: "In Transit",
  under_inspection: "Under Inspection",
  reconciliation_required: "Reconciliation Required",
  initiated: "Initiated",
  started: "Started",
  completed: "Completed",
  open: "Open",
  resolved: "Resolved",
  healthy: "Healthy",
  stale: "Stale",
  pass: "Pass",
  fail: "Fail",
  review: "Review",
  high: "High",
  medium: "Medium",
  low: "Low",
  TRANSFER_NOT_CONFIRMED: "Transfer Confirmation Overdue",
  ASSET_OBSERVED_AT_MULTIPLE_SITES: "Conflicting Site Observations",
  INSPECTION_MISSING_EVIDENCE: "Inspection Evidence Missing",
  SITE_PROJECTION_STALE: "Site Sync Stale",
  PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM: "Projection Lag Detected"
};

export function formatCodeLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  if (labelOverrides[value]) {
    return labelOverrides[value];
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTimestamp(
  value: string | null | undefined,
  emptyLabel = "Never"
): string {
  if (!value) {
    return emptyLabel;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatRelativeAge(
  value: string | null | undefined,
  emptyLabel = ""
): string {
  if (!value) {
    return emptyLabel;
  }

  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0) {
    return "just now";
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${String(minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${String(hours)}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

export function formatTimestampWithAge(
  value: string | null | undefined,
  emptyLabel = "Never"
): string {
  if (!value) {
    return emptyLabel;
  }
  return `${formatTimestamp(value, emptyLabel)} (${formatRelativeAge(value)})`;
}

export function shortId(value: string | null | undefined, size = 8): string {
  if (!value) {
    return "-";
  }
  return value.length > size ? `${value.slice(0, size)}...` : value;
}
