import { notFound } from "next/navigation";
import { CopyValue } from "../../../components/copy-value";
import { StatusBadge } from "../../../components/status-badge";
import { fetchJson } from "../../../lib/api";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../../../lib/format";

type SyncBatchDetailsResponse = {
  data: {
    batch: {
      id: string;
      siteId: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      queuedEventCount: number;
      acceptedEventCount: number;
      rejectedEventCount: number;
      replayResultSummary: string | null;
    };
    site: { id: string; code: string; name: string } | null;
    replayedEvents: Array<{
      id: string;
      sequence_number: number;
      event_type: string;
      asset_id: string | null;
      site_id: string;
      occurred_at: string;
      source_site_event_id: string | null;
      payload: Record<string, unknown>;
    }>;
    replayDiagnostics: {
      idempotencyModel: string;
      rejectionReasons: string[];
    };
  };
};

export default async function SyncBatchDetailPage({
  params
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  let details: SyncBatchDetailsResponse;

  try {
    details = await fetchJson<SyncBatchDetailsResponse>(`/sync-batches/${batchId}`);
  } catch {
    notFound();
  }

  const batch = details.data.batch;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Sync Batch Detail</h2>
        <p className="mb-3 text-xs text-fgMuted">Replay batch execution details, ingestion outcomes, and idempotency handling context.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Batch ID</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs">{shortId(batch.id, 14)}</span>
              <CopyValue value={batch.id} label="sync batch id" />
            </div>
            <div className="mt-2"><StatusBadge value={batch.status} /></div>
          </div>
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Source Site</div>
            <div className="font-medium">{details.data.site?.code ?? shortId(batch.siteId, 8)}</div>
            <div className="text-xs text-fgMuted">{details.data.site?.name ?? batch.siteId}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Started</div>
            <div>{formatTimestampWithAge(batch.startedAt)}</div>
            <div className="mt-2 text-xs text-fgMuted">Completed</div>
            <div>{formatTimestampWithAge(batch.completedAt, "In Progress")}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted p-3">
            <div className="text-xs text-fgMuted">Replay Counts</div>
            <div className="text-sm">Queued {batch.queuedEventCount}</div>
            <div className="text-sm">Accepted {batch.acceptedEventCount}</div>
            <div className="text-sm">Rejected {batch.rejectedEventCount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Replay Diagnostics</h3>
        <p className="text-sm text-fgMuted">{details.data.replayDiagnostics.idempotencyModel}</p>
        {details.data.replayDiagnostics.rejectionReasons.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-fgMuted">
            {details.data.replayDiagnostics.rejectionReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-fgMuted">No replay rejections were recorded for this batch.</p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-base font-semibold">Replayed Events</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Sequence</th>
                <th>Event</th>
                <th>Asset</th>
                <th>Occurred</th>
                <th>Source Event ID</th>
              </tr>
            </thead>
            <tbody>
              {details.data.replayedEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.sequence_number}</td>
                  <td>{formatCodeLabel(event.event_type)}</td>
                  <td className="font-mono text-xs">{shortId(event.asset_id, 10)}</td>
                  <td>{formatTimestampWithAge(event.occurred_at)}</td>
                  <td className="font-mono text-xs">{event.source_site_event_id ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
