import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { StatusBadge } from "../../components/status-badge";
import { formatTimestampWithAge } from "../../lib/format";

type SitesResponse = {
  data: Array<{
    id: string;
    code: string;
    name: string;
    lastSyncCompletedAt: string | null;
    syncHealth: "healthy" | "stale";
  }>;
};

export default async function SitesPage() {
  const sites = await fetchJson<SitesResponse>("/sites");
  const snapshotAt = new Date().toISOString();
  const staleCount = sites.data.filter((site) => site.syncHealth === "stale").length;
  const healthyCount = sites.data.filter((site) => site.syncHealth === "healthy").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-lg font-semibold">Site Sync Health</h2>
        <p className="text-xs text-fgMuted">Site synchronization posture against stale thresholds and most recent successful sync completion.</p>
        <p className="mb-3 text-xs text-fgMuted">Snapshot time {formatTimestampWithAge(snapshotAt)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Healthy Sites</div>
            <div className="text-lg font-semibold">{healthyCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Stale Sites</div>
            <div className="text-lg font-semibold">{staleCount}</div>
          </div>
          <div className="rounded border border-line bg-panelMuted px-3 py-2">
            <div className="text-xs text-fgMuted">Total Sites</div>
            <div className="text-lg font-semibold">{sites.data.length}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-2">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Name</th>
                <th>Last Sync Completed</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {sites.data.map((site) => (
                <tr key={site.id}>
                  <td className="font-medium">
                    <Link href={`/sites/${site.id}`} className="text-fg">
                      {site.code}
                    </Link>
                  </td>
                  <td>{site.name}</td>
                  <td>{formatTimestampWithAge(site.lastSyncCompletedAt)}</td>
                  <td>
                    <StatusBadge value={site.syncHealth} />
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
