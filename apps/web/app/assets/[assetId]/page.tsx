import { notFound } from "next/navigation";
import { fetchJson } from "../../../lib/api";
import { CopyValue } from "../../../components/copy-value";
import { StatusBadge } from "../../../components/status-badge";
import { formatCodeLabel, formatTimestampWithAge, shortId } from "../../../lib/format";

type AssetDetailsResponse = {
  data: {
    projection: {
      assetId: string;
      serialNumber: string;
      currentSiteId: string | null;
      status: string;
      lastEventType: string;
      lastEventAt: string;
      lastSequence: number;
      version: number;
    };
    timeline: Array<{
      id: string;
      sequenceNumber: number;
      eventType: string;
      siteId: string;
      occurredAt: string;
    }>;
    inspections: Array<{
      id: string;
      status: string;
      notes: string;
      inspected_at: string;
      evidence_count: number;
    }>;
    evidenceMetadata: Array<{
      id: string;
      inspection_id: string;
      mime_type: string;
      sha256: string;
      storage_ref: string;
      recorded_at: string;
    }>;
  };
};

export default async function AssetPage({
  params
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  let asset: AssetDetailsResponse;

  try {
    asset = await fetchJson<AssetDetailsResponse>(`/assets/${assetId}`);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-lg font-semibold">Asset Projection</h2>
        <p className="mb-3 text-xs text-fgMuted">Current projection and recent accepted event metadata for this asset.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-fgMuted">Asset ID</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{asset.data.projection.assetId}</span>
              <CopyValue value={asset.data.projection.assetId} label="asset id" />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-fgMuted">Serial Number</div>
            <div>{asset.data.projection.serialNumber}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-fgMuted">Current Site</div>
            <div className="font-mono text-sm" title={asset.data.projection.currentSiteId ?? undefined}>
              {shortId(asset.data.projection.currentSiteId, 12)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-fgMuted">Status</div>
            <StatusBadge value={asset.data.projection.status} />
          </div>
          <div>
            <div className="text-xs uppercase text-fgMuted">Last Event</div>
            <div>{formatCodeLabel(asset.data.projection.lastEventType)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-fgMuted">Last Updated</div>
            <div>{formatTimestampWithAge(asset.data.projection.lastEventAt)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-3 text-base font-semibold">Event Timeline</h3>
        <table>
          <thead>
            <tr>
              <th>Sequence</th>
              <th>Event Type</th>
              <th>Site</th>
              <th>Occurred At</th>
            </tr>
          </thead>
          <tbody>
            {asset.data.timeline.map((event) => (
              <tr key={event.id}>
                <td>{event.sequenceNumber}</td>
                <td>{formatCodeLabel(event.eventType)}</td>
                <td className="font-mono text-xs" title={event.siteId}>{shortId(event.siteId, 10)}</td>
                <td>{formatTimestampWithAge(event.occurredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-3 text-base font-semibold">Inspections</h3>
        <table>
          <thead>
            <tr>
              <th>Inspection</th>
              <th>Status</th>
              <th>Evidence Count</th>
              <th>Recorded At</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {asset.data.inspections.map((inspection) => (
              <tr key={inspection.id}>
                <td className="font-mono text-xs" title={inspection.id}>{shortId(inspection.id, 10)}</td>
                <td>
                  <StatusBadge value={inspection.status} />
                </td>
                <td>{inspection.evidence_count}</td>
                <td>{formatTimestampWithAge(inspection.inspected_at)}</td>
                <td>{inspection.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-3 text-base font-semibold">Evidence Metadata</h3>
        <table>
          <thead>
            <tr>
              <th>Evidence</th>
              <th>Inspection</th>
              <th>MIME Type</th>
              <th>SHA256</th>
              <th>Recorded At</th>
            </tr>
          </thead>
          <tbody>
            {asset.data.evidenceMetadata.map((evidence) => (
              <tr key={evidence.id}>
                <td className="font-mono text-xs" title={evidence.id}>{shortId(evidence.id, 10)}</td>
                <td className="font-mono text-xs" title={evidence.inspection_id}>{shortId(evidence.inspection_id, 10)}</td>
                <td>{evidence.mime_type}</td>
                <td className="font-mono text-xs" title={evidence.sha256}>{shortId(evidence.sha256, 20)}</td>
                <td>{formatTimestampWithAge(evidence.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
