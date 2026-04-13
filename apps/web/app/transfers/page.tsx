import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { CopyValue } from "../../components/copy-value";
import { StatusBadge } from "../../components/status-badge";
import { formatTimestampWithAge, shortId } from "../../lib/format";

type TransfersResponse = {
  data: Array<{
    id: string;
    assetId: string;
    originSiteId: string;
    destinationSiteId: string;
    status: string;
    initiatedAt: string;
    completedAt: string | null;
  }>;
};

export default async function TransfersPage() {
  const transfers = await fetchJson<TransfersResponse>("/transfers");
  const snapshotAt = new Date().toISOString();
  const pendingCount = transfers.data.filter((transfer) => transfer.status !== "completed").length;
  const completedCount = transfers.data.filter((transfer) => transfer.status === "completed").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Transfer Timeline</h2>
        <p className="text-xs text-fgMuted">Transfer orders with lifecycle state, origin/destination custody, and confirmation timing.</p>
        <p className="mb-3 text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Open Transfers</div>
            <div className="text-lg font-semibold">{pendingCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Completed Transfers</div>
            <div className="text-lg font-semibold">{completedCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Total Transfers</div>
            <div className="text-lg font-semibold">{transfers.data.length}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-2">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Transfer</th>
                <th>Asset</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Initiated</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {transfers.data.map((transfer) => (
                <tr key={transfer.id}>
                  <td title={transfer.id}>
                    <div className="flex items-center gap-2">
                      <Link href={`/transfers/${transfer.id}`} className="font-mono text-xs text-fg">
                        {shortId(transfer.id, 10)}
                      </Link>
                      <CopyValue value={transfer.id} label="transfer id" />
                    </div>
                  </td>
                  <td title={transfer.assetId}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{shortId(transfer.assetId, 10)}</span>
                      <CopyValue value={transfer.assetId} label="asset id" />
                    </div>
                  </td>
                  <td className="font-mono text-xs" title={transfer.originSiteId}>{shortId(transfer.originSiteId, 8)}</td>
                  <td className="font-mono text-xs" title={transfer.destinationSiteId}>{shortId(transfer.destinationSiteId, 8)}</td>
                  <td>
                    <StatusBadge value={transfer.status} />
                  </td>
                  <td>{formatTimestampWithAge(transfer.initiatedAt)}</td>
                  <td>{formatTimestampWithAge(transfer.completedAt, "Pending")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
