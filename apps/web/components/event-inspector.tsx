import {
  formatCodeLabel,
  formatTimestampWithAge,
  shortId,
  summarizeEventPayload
} from "../lib/format";

type EventInspectorProps = {
  eventType: string;
  sequenceNumber: number;
  siteId: string;
  sourceSiteEventId?: string | null;
  occurredAt: string;
  acceptedAt: string;
  payload: Record<string, unknown>;
};

export function EventInspector({
  eventType,
  sequenceNumber,
  siteId,
  sourceSiteEventId,
  occurredAt,
  acceptedAt,
  payload
}: EventInspectorProps) {
  return (
    <details className="text-xs text-fgMuted">
      <summary className="cursor-pointer select-none rounded border border-line/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide hover:border-line hover:text-fg">
        Inspect
      </summary>
      <div className="mt-2 rounded border border-line bg-panelMuted p-2">
        <div>Type: {formatCodeLabel(eventType)}</div>
        <div>Sequence: {sequenceNumber}</div>
        <div title={siteId}>Site: {shortId(siteId, 12)}</div>
        <div title={sourceSiteEventId ?? undefined}>
          Source Event ID: {sourceSiteEventId ? shortId(sourceSiteEventId, 16) : "-"}
        </div>
        <div>Occurred: {formatTimestampWithAge(occurredAt)}</div>
        <div>Accepted: {formatTimestampWithAge(acceptedAt)}</div>
        <div>Payload Summary: {summarizeEventPayload(eventType, payload)}</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-fgMuted">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </details>
  );
}
