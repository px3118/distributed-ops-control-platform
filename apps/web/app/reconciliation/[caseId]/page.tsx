import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "../../../components/status-badge";
import { fetchJson } from "../../../lib/api";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../../../lib/format";

type CaseDetailsResponse = {
  data: {
    case: {
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
    };
    sourceAlert: {
      id: string;
      ruleCode: string;
      severity: string;
      status: string;
      summary: string;
      details: Record<string, unknown>;
      detectedAt: string;
    } | null;
    projection: {
      assetId: string;
      status: string;
      currentSiteId: string | null;
      lastEventType: string;
      lastEventAt: string;
      lastSequence: number;
      version: number;
    } | null;
    relatedEvents: Array<{
      id: string;
      sequence_number: number;
      event_type: string;
      site_id: string;
      transfer_order_id: string | null;
      sync_batch_id: string | null;
      occurred_at: string;
      payload: Record<string, unknown>;
    }>;
  };
};

export default async function ReconciliationCaseDetailPage({
  params
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  let details: CaseDetailsResponse;

  try {
    details = await fetchJson<CaseDetailsResponse>(`/reconciliation-cases/${caseId}`);
  } catch {
    notFound();
  }

  const record = details.data.case;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Reconciliation Case Detail</h2>
        <p className="mb-3 text-xs text-fgMuted">Case context, source signal, linked state, and event chain for operator resolution.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Case ID</div>
            <div className="font-mono text-sm">{shortId(record.id, 14)}</div>
            <div className="mt-2"><StatusBadge value={record.status} /></div>
          </div>
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Opened</div>
            <div>{formatTimestampWithAge(record.openedAt)}</div>
            <div className="mt-2 text-xs text-fgMuted">By {record.openedBy}</div>
            {record.resolvedAt ? (
              <div className="mt-2 text-xs text-fgMuted">Resolved {formatTimestampWithAge(record.resolvedAt)} by {record.resolvedBy}</div>
            ) : null}
          </div>
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Linked Asset</div>
            {record.assetId ? (
              <Link href={`/assets/${record.assetId}`} className="font-mono text-xs text-fg">
                {shortId(record.assetId, 12)}
              </Link>
            ) : (
              <span className="text-sm text-fgMuted">None</span>
            )}
            <div className="mt-2 text-xs text-fgMuted">Linked Alert</div>
            <div className="font-mono text-xs">{shortId(record.alertId, 12)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Case Summary</h3>
        <p className="text-sm"><span className="font-medium">Title:</span> {record.title}</p>
        <p className="mt-2 text-sm"><span className="font-medium">Why Opened:</span> {record.description}</p>
        {record.resolutionSummary ? (
          <p className="mt-2 text-sm"><span className="font-medium">Resolution:</span> {record.resolutionSummary}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Source Alert</h3>
        {details.data.sourceAlert ? (
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <div className="text-xs text-fgMuted">Rule</div>
              <div>{formatCodeLabel(details.data.sourceAlert.ruleCode)}</div>
            </div>
            <div>
              <div className="text-xs text-fgMuted">Severity</div>
              <StatusBadge value={details.data.sourceAlert.severity} />
            </div>
            <div>
              <div className="text-xs text-fgMuted">Status</div>
              <StatusBadge value={details.data.sourceAlert.status} />
            </div>
            <div>
              <div className="text-xs text-fgMuted">Detected</div>
              <div>{formatTimestampWithAge(details.data.sourceAlert.detectedAt)}</div>
            </div>
            <div className="md:col-span-4">
              <div className="text-xs text-fgMuted">Summary</div>
              <div>{details.data.sourceAlert.summary}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fgMuted">No source alert is linked to this case.</p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Current Projection</h3>
        {details.data.projection ? (
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <div className="text-xs text-fgMuted">Status</div>
              <StatusBadge value={details.data.projection.status} />
            </div>
            <div>
              <div className="text-xs text-fgMuted">Current Site</div>
              <div className="font-mono text-xs">{shortId(details.data.projection.currentSiteId, 10)}</div>
            </div>
            <div>
              <div className="text-xs text-fgMuted">Last Event</div>
              <div>{formatCodeLabel(details.data.projection.lastEventType)}</div>
            </div>
            <div>
              <div className="text-xs text-fgMuted">Last Updated</div>
              <div>{formatTimestampWithAge(details.data.projection.lastEventAt)}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fgMuted">No asset projection is linked to this case.</p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Related Event Chain</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Sequence</th>
                <th>Event</th>
                <th>Site</th>
                <th>Occurred</th>
                <th>Transfer</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {details.data.relatedEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.sequence_number}</td>
                  <td>{formatCodeLabel(event.event_type)}</td>
                  <td className="font-mono text-xs">{shortId(event.site_id, 10)}</td>
                  <td>{formatTimestampWithAge(event.occurred_at)}</td>
                  <td className="font-mono text-xs">{shortId(event.transfer_order_id, 10)}</td>
                  <td className="font-mono text-xs">{shortId(event.sync_batch_id, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
