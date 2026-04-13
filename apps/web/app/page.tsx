import Link from "next/link";
import { StatusBadge } from "../components/status-badge";
import { fetchJson } from "../lib/api";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../lib/format";

type DashboardResponse = {
  data: {
    summary: {
      openReconciliationCases: number;
      staleSites: number;
      assetsInTransit: number;
      recentAlerts: number;
      replaySuccessCount: number;
      replayFailureCount: number;
      unresolvedEvidenceGaps: number;
    };
    recentTransfers: Array<Record<string, unknown>>;
    recentAlerts: Array<Record<string, unknown>>;
    recentSyncBatches: Array<Record<string, unknown>>;
  };
};

const metrics = [
  { key: "openReconciliationCases", label: "Open Reconciliation Cases", href: "/reconciliation" },
  { key: "staleSites", label: "Sites With Stale Sync", href: "/sites" },
  { key: "assetsInTransit", label: "Assets In Transit", href: "/transfers" },
  { key: "recentAlerts", label: "Alerts Raised (24h)", href: "/reconciliation" },
  { key: "replaySuccessCount", label: "Replay Events Accepted (24h)", href: "/sync-batches" },
  { key: "replayFailureCount", label: "Replay Events Rejected (24h)", href: "/sync-batches" },
  { key: "unresolvedEvidenceGaps", label: "Inspections With Evidence Gaps", href: "/assets" }
] as const;

export default async function HomePage() {
  const dashboard = await fetchJson<DashboardResponse>("/dashboard");
  const snapshotAt = new Date().toISOString();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel px-4 py-2">
        <p className="text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.key} href={metric.href} className="rounded-lg border border-line bg-panel p-4 transition-colors hover:bg-panelMuted/50">
            <article>
              <h2 className="text-sm text-fgMuted">{metric.label}</h2>
              <p className="mt-2 text-2xl font-semibold">{dashboard.data.summary[metric.key]}</p>
            </article>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fgMuted">Recent Transfers</h3>
          <p className="mb-3 text-xs text-fgMuted">Recent transfer orders and confirmation state at destination.</p>
          <div className="space-y-2 text-sm">
            {dashboard.data.recentTransfers.map((transfer) => (
              <div key={String(transfer.id)} className="rounded border border-line bg-panelMuted p-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-fgMuted" title={String(transfer.id)}>
                    {shortId(String(transfer.id), 10)}
                  </div>
                  <StatusBadge value={String(transfer.status)} />
                </div>
                <div className="mt-1 text-xs text-fgMuted">
                  Initiated {formatTimestampWithAge(String(transfer.initiatedAt ?? ""))}
                </div>
                <div className="mt-1 text-xs text-fgMuted">
                  Confirmed {formatTimestampWithAge((transfer.completedAt as string | null | undefined) ?? null, "Pending")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fgMuted">Recent Alerts</h3>
          <p className="mb-3 text-xs text-fgMuted">Latest divergence conditions requiring operator review.</p>
          <div className="space-y-2 text-sm">
            {dashboard.data.recentAlerts.map((alert) => (
              <div key={String(alert.id)} className="rounded border border-line bg-panelMuted p-2">
                <div className="flex items-center justify-between">
                  <div>{formatCodeLabel(String(alert.ruleCode))}</div>
                  <StatusBadge value={String(alert.severity)} />
                </div>
                <div className="text-fgMuted">{String(alert.summary)}</div>
                <div className="mt-1 text-xs text-fgMuted">
                  Detected {formatTimestampWithAge(String(alert.detectedAt ?? ""))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fgMuted">Recent Sync Batches</h3>
          <p className="mb-3 text-xs text-fgMuted">Replay outcomes from recent site synchronization batches.</p>
          <div className="space-y-2 text-sm">
            {dashboard.data.recentSyncBatches.map((batch) => (
              <div key={String(batch.id)} className="rounded border border-line bg-panelMuted p-2">
                <div className="font-mono text-xs text-fgMuted" title={String(batch.id)}>
                  {shortId(String(batch.id), 10)}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <StatusBadge value={String(batch.status)} />
                  <span className="text-xs text-fgMuted">
                    accepted {String(batch.acceptedEventCount)} rejected {String(batch.rejectedEventCount)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-fgMuted">
                  Started {formatTimestampWithAge(String(batch.startedAt ?? ""))}
                </div>
                <div className="mt-1 text-xs text-fgMuted">
                  Completed {formatTimestampWithAge((batch.completedAt as string | null | undefined) ?? null, "In Progress")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
