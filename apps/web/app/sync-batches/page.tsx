import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { CopyValue } from "../../components/copy-value";
import { StatusBadge } from "../../components/status-badge";
import { formatTimestampWithAge, shortId } from "../../lib/format";

type SyncBatchResponse = {
  data: Array<{
    id: string;
    siteId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    queuedEventCount: number;
    acceptedEventCount: number;
    rejectedEventCount: number;
    replayResultSummary: string | null;
  }>;
};

export default async function SyncBatchesPage() {
  const batches = await fetchJson<SyncBatchResponse>("/sync-batches");
  const snapshotAt = new Date().toISOString();
  const completedCount = batches.data.filter((batch) => batch.status === "completed").length;
  const inProgressCount = batches.data.filter((batch) => batch.status !== "completed").length;
  const totalRejected = batches.data.reduce((sum, batch) => sum + batch.rejectedEventCount, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Sync Batch Outcomes</h2>
        <p className="text-xs text-fgMuted">Batch replay outcomes with queued, accepted, and rejected event counts per site submission.</p>
        <p className="mb-3 text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Completed Batches</div>
            <div className="text-lg font-semibold">{completedCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">In Progress</div>
            <div className="text-lg font-semibold">{inProgressCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Rejected Events</div>
            <div className="text-lg font-semibold">{totalRejected}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Total Batches</div>
            <div className="text-lg font-semibold">{batches.data.length}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-2">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Site</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Queued</th>
                <th>Accepted</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {batches.data.map((batch) => (
                <tr key={batch.id}>
                  <td title={batch.id}>
                    <div className="flex items-center gap-2">
                      <Link href={`/sync-batches/${batch.id}`} className="font-mono text-xs text-fg">
                        {shortId(batch.id, 10)}
                      </Link>
                      <CopyValue value={batch.id} label="sync batch id" />
                    </div>
                  </td>
                  <td className="font-mono text-xs" title={batch.siteId}>{shortId(batch.siteId, 8)}</td>
                  <td>
                    <StatusBadge value={batch.status} />
                  </td>
                  <td>{formatTimestampWithAge(batch.startedAt)}</td>
                  <td>{formatTimestampWithAge(batch.completedAt, "In Progress")}</td>
                  <td>{batch.queuedEventCount}</td>
                  <td>{batch.acceptedEventCount}</td>
                  <td>{batch.rejectedEventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
