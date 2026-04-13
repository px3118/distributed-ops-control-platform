import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { CopyValue } from "../../components/copy-value";
import { StatusBadge } from "../../components/status-badge";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../../lib/format";

type AssetsResponse = {
  data: Array<{
    assetId: string;
    serialNumber: string;
    currentSiteId: string | null;
    status: string;
    lastEventType: string;
    lastEventAt: string;
    lastSequence: number;
    version: number;
  }>;
};

export default async function AssetsPage() {
  const assets = await fetchJson<AssetsResponse>("/assets");
  const snapshotAt = new Date().toISOString();
  const inTransitCount = assets.data.filter((asset) => asset.status === "in_transit").length;
  const requiresReviewCount = assets.data.filter((asset) => asset.status === "reconciliation_required").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Assets</h2>
        <p className="text-xs text-fgMuted">Projected asset state from the accepted event stream, including current custody and lifecycle status.</p>
        <p className="mb-3 text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Tracked Assets</div>
            <div className="text-lg font-semibold">{assets.data.length}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">In Transit</div>
            <div className="text-lg font-semibold">{inTransitCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Requires Reconciliation</div>
            <div className="text-lg font-semibold">{requiresReviewCount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-2">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Serial</th>
                <th>Current Site</th>
                <th>Status</th>
                <th>Last Event</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {assets.data.map((asset) => (
                <tr key={asset.assetId}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link href={`/assets/${asset.assetId}`} className="font-mono text-xs text-fg" title={asset.assetId}>
                        {shortId(asset.assetId, 10)}
                      </Link>
                      <CopyValue value={asset.assetId} label="asset id" />
                    </div>
                  </td>
                  <td className="font-medium">{asset.serialNumber}</td>
                  <td className="font-mono text-xs" title={asset.currentSiteId ?? undefined}>
                    {shortId(asset.currentSiteId, 8)}
                  </td>
                  <td>
                    <StatusBadge value={asset.status} />
                  </td>
                  <td>{formatCodeLabel(asset.lastEventType)}</td>
                  <td>{formatTimestampWithAge(asset.lastEventAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
