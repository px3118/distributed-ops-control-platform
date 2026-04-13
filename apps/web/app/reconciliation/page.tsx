import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { CopyValue } from "../../components/copy-value";
import { StatusBadge } from "../../components/status-badge";
import { ReconciliationActions } from "../../components/reconciliation-actions";
import { OpenCaseForm } from "../../components/open-case-form";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../../lib/format";

type CasesResponse = {
  data: Array<{
    id: string;
    alertId: string | null;
    assetId: string | null;
    siteId: string | null;
    status: string;
    title: string;
    description: string;
    openedBy: string;
    openedAt: string;
    resolvedBy: string | null;
    resolvedAt: string | null;
    resolutionSummary: string | null;
  }>;
};

type AlertsResponse = {
  data: Array<{
    id: string;
    ruleCode: string;
    severity: string;
    status: string;
    assetId: string | null;
    siteId: string | null;
    summary: string;
    details: Record<string, unknown>;
    detectedAt: string;
  }>;
};

export default async function ReconciliationPage() {
  const [cases, alerts] = await Promise.all([
    fetchJson<CasesResponse>("/reconciliation-cases"),
    fetchJson<AlertsResponse>("/alerts")
  ]);
  const snapshotAt = new Date().toISOString();
  const openCaseCount = cases.data.filter((record) => record.status === "open").length;
  const highSeverityAlerts = alerts.data.filter((alert) => alert.severity === "high").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Reconciliation Workbench</h2>
        <p className="text-xs text-fgMuted">Alert triage and operator-managed case resolution linked to immutable event history.</p>
        <p className="mb-3 text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Open Cases</div>
            <div className="text-lg font-semibold">{openCaseCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">High Severity Alerts</div>
            <div className="text-lg font-semibold">{highSeverityAlerts}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Total Alerts</div>
            <div className="text-lg font-semibold">{alerts.data.length}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Divergence Alerts</h2>
        <p className="mb-4 text-xs text-fgMuted">Alerts are generated from transfer, inspection evidence, sync staleness, and projection integrity rules.</p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Rule</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Asset</th>
                <th>Summary</th>
                <th>Detected At</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((alert) => (
                <tr key={alert.id}>
                  <td title={alert.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{shortId(alert.id, 10)}</span>
                      <CopyValue value={alert.id} label="alert id" />
                    </div>
                  </td>
                  <td>{formatCodeLabel(alert.ruleCode)}</td>
                  <td>
                    <StatusBadge value={alert.severity} />
                  </td>
                  <td>
                    <StatusBadge value={alert.status} />
                  </td>
                  <td className="font-mono text-xs" title={alert.assetId ?? undefined}>{shortId(alert.assetId, 10)}</td>
                  <td>{alert.summary}</td>
                  <td>{formatTimestampWithAge(alert.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Reconciliation Cases</h2>
        <p className="mb-4 text-xs text-fgMuted">Open cases represent active operator investigations. Resolution writes a closing event back to the stream.</p>
        <OpenCaseForm />
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Title</th>
                <th>Asset</th>
                <th>Opened By</th>
                <th>Opened At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.data.map((record) => (
                <tr key={record.id}>
                  <td title={record.id}>
                    <div className="flex items-center gap-2">
                      <Link href={`/reconciliation/${record.id}`} className="font-mono text-xs text-fg">
                        {shortId(record.id, 10)}
                      </Link>
                      <CopyValue value={record.id} label="case id" />
                    </div>
                  </td>
                  <td>
                    <StatusBadge value={record.status} />
                  </td>
                  <td className="font-medium">{record.title}</td>
                  <td className="font-mono text-xs" title={record.assetId ?? undefined}>{shortId(record.assetId, 10)}</td>
                  <td>{record.openedBy}</td>
                  <td>{formatTimestampWithAge(record.openedAt)}</td>
                  <td className="min-w-[24rem]">
                    {record.status === "open" ? (
                      <ReconciliationActions caseId={record.id} defaultOperator="ops-supervisor" />
                    ) : (
                      <span className="text-xs text-fgMuted">
                        Resolved by {record.resolvedBy} at {formatTimestampWithAge(record.resolvedAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
