import { createEventRequestSchema, type CreateEventRequest } from "@ops/contracts";
import { applyEventToProjection, type DomainEvent } from "@ops/domain";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { db as databaseClient } from "../db/client";
import {
  assetProjection,
  assets,
  eventLog,
  evidenceMetadata,
  inspections,
  reconciliationCases,
  sites,
  syncBatches,
  transferOrders
} from "../db/schema";
import { ApiError } from "../lib/errors";
import { incrementCounter } from "../lib/metrics";

type Database = typeof databaseClient;

type IngestOptions = {
  syncBatchId?: string;
};

export type IngestResult = {
  eventId: string;
  sequenceNumber: number;
  deduplicated: boolean;
};

function needsAssetProjection(eventType: string): boolean {
  return [
    "asset_registered",
    "asset_moved",
    "asset_received",
    "inspection_recorded",
    "evidence_attached",
    "transfer_initiated",
    "transfer_completed",
    "divergence_detected",
    "reconciliation_resolved"
  ].includes(eventType);
}

async function ensureSiteExists(db: Database, siteId: string): Promise<void> {
  const existing = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!existing[0]) {
    throw new ApiError(400, `Unknown siteId ${siteId}`);
  }
}

async function applyEventSideEffects(
  db: Database,
  event: CreateEventRequest,
  eventId: string,
  occurredAt: Date
): Promise<void> {
  switch (event.eventType) {
    case "asset_registered": {
      if (!event.assetId) {
        throw new ApiError(400, "asset_registered requires assetId");
      }
      await db
        .insert(assets)
        .values({
          id: event.assetId,
          serialNumber: String(event.payload.serialNumber),
          containerId: (event.payload.containerId as string | undefined) ?? null,
          registeredSiteId: event.siteId
        })
        .onConflictDoNothing();
      break;
    }
    case "transfer_initiated": {
      if (!event.assetId) {
        throw new ApiError(400, "transfer_initiated requires assetId");
      }
      const transferOrderId = String(event.payload.transferOrderId);
      await db
        .insert(transferOrders)
        .values({
          id: transferOrderId,
          assetId: event.assetId,
          originSiteId: String(event.payload.originSiteId),
          destinationSiteId: String(event.payload.destinationSiteId),
          status: "initiated",
          initiatedBy: String(event.payload.initiatedBy),
          initiatedAt: occurredAt
        })
        .onConflictDoUpdate({
          target: transferOrders.id,
          set: {
            status: "initiated",
            initiatedAt: occurredAt,
            initiatedBy: String(event.payload.initiatedBy)
          }
        });
      break;
    }
    case "transfer_completed": {
      const transferOrderId = String(event.payload.transferOrderId);
      await db
        .update(transferOrders)
        .set({
          status: "completed",
          completedAt: occurredAt,
          completionNote: (event.payload.completionNote as string | undefined) ?? null
        })
        .where(eq(transferOrders.id, transferOrderId));
      break;
    }
    case "inspection_recorded": {
      if (!event.assetId) {
        throw new ApiError(400, "inspection_recorded requires assetId");
      }
      await db
        .insert(inspections)
        .values({
          id: String(event.payload.inspectionId),
          assetId: event.assetId,
          siteId: event.siteId,
          status: String(event.payload.status),
          notes: String(event.payload.notes),
          inspectedAt: occurredAt,
          createdEventId: eventId
        })
        .onConflictDoNothing();
      break;
    }
    case "evidence_attached": {
      await db
        .insert(evidenceMetadata)
        .values({
          id: String(event.payload.evidenceId),
          inspectionId: String(event.payload.inspectionId),
          mimeType: String(event.payload.mimeType),
          sha256: String(event.payload.sha256),
          storageRef: `evidence://${String(event.payload.evidenceId)}`
        })
        .onConflictDoNothing();
      break;
    }
    case "site_sync_started": {
      await db
        .insert(syncBatches)
        .values({
          id: String(event.payload.syncBatchId),
          siteId: event.siteId,
          status: "started",
          startedAt: occurredAt,
          queuedEventCount: Number(event.payload.queuedEventCount),
          acceptedEventCount: 0,
          rejectedEventCount: 0
        })
        .onConflictDoUpdate({
          target: syncBatches.id,
          set: {
            status: "started",
            queuedEventCount: Number(event.payload.queuedEventCount),
            startedAt: occurredAt
          }
        });
      break;
    }
    case "site_sync_completed": {
      await db
        .update(syncBatches)
        .set({
          status: "completed",
          completedAt: occurredAt,
          acceptedEventCount: Number(event.payload.acceptedEventCount),
          rejectedEventCount: Number(event.payload.rejectedEventCount),
          replayResultSummary: `accepted=${String(event.payload.acceptedEventCount)} rejected=${String(event.payload.rejectedEventCount)}`
        })
        .where(eq(syncBatches.id, String(event.payload.syncBatchId)));

      await db
        .update(sites)
        .set({
          lastSyncCompletedAt: occurredAt,
          updatedAt: new Date()
        })
        .where(eq(sites.id, event.siteId));
      break;
    }
    case "reconciliation_opened": {
      await db
        .insert(reconciliationCases)
        .values({
          id: String(event.payload.caseId),
          alertId: String(event.payload.alertId),
          assetId: event.assetId,
          siteId: event.siteId,
          status: "open",
          title: "Reconciliation review required",
          description: "Case opened from accepted event stream for operator review.",
          openedBy: String(event.payload.openedBy)
        })
        .onConflictDoNothing();
      break;
    }
    case "reconciliation_resolved": {
      await db
        .update(reconciliationCases)
        .set({
          status: "resolved",
          resolvedBy: String(event.payload.resolvedBy),
          resolvedAt: occurredAt,
          resolutionSummary: String(event.payload.resolutionSummary)
        })
        .where(eq(reconciliationCases.id, String(event.payload.caseId)));
      break;
    }
    default:
      break;
  }
}

async function updateProjectionFromEvent(
  db: Database,
  event: CreateEventRequest,
  eventId: string,
  sequenceNumber: number
): Promise<void> {
  if (!event.assetId || !needsAssetProjection(event.eventType)) {
    return;
  }

  const existingProjection = await db
    .select()
    .from(assetProjection)
    .where(eq(assetProjection.assetId, event.assetId))
    .limit(1);

  if (existingProjection[0] && existingProjection[0].lastSequence >= sequenceNumber) {
    return;
  }

  const assetRow = await db.select().from(assets).where(eq(assets.id, event.assetId)).limit(1);
  if (!assetRow[0]) {
    throw new ApiError(400, `Unknown assetId ${event.assetId}`);
  }

  const prior = existingProjection[0]
    ? {
        assetId: existingProjection[0].assetId,
        serialNumber: existingProjection[0].serialNumber,
        currentSiteId: existingProjection[0].currentSiteId,
        containerId: existingProjection[0].containerId,
        status: existingProjection[0].status as
          | "registered"
          | "in_transit"
          | "at_site"
          | "under_inspection"
          | "reconciliation_required",
        lastEventType: existingProjection[0].lastEventType as DomainEvent["eventType"],
        lastEventAt: existingProjection[0].lastEventAt.toISOString(),
        lastSequence: existingProjection[0].lastSequence,
        version: existingProjection[0].version
      }
    : null;

  const next = applyEventToProjection(prior, {
    eventId,
    eventType: event.eventType,
    sequenceNumber,
    assetId: event.assetId,
    siteId: event.siteId,
    transferOrderId: event.transferOrderId ?? null,
    occurredAt: event.occurredAt,
    payload: event.payload
  });

  if (!next) {
    return;
  }

  await db
    .insert(assetProjection)
    .values({
      assetId: next.assetId,
      serialNumber: next.serialNumber === "unknown" ? assetRow[0].serialNumber : next.serialNumber,
      currentSiteId: next.currentSiteId,
      containerId: next.containerId,
      status: next.status,
      lastEventType: next.lastEventType,
      lastEventAt: new Date(next.lastEventAt),
      lastSequence: next.lastSequence,
      version: next.version,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: assetProjection.assetId,
      set: {
        currentSiteId: next.currentSiteId,
        containerId: next.containerId,
        status: next.status,
        lastEventType: next.lastEventType,
        lastEventAt: new Date(next.lastEventAt),
        lastSequence: next.lastSequence,
        version: next.version,
        updatedAt: new Date()
      }
    });
}

export async function ingestEvent(
  db: Database,
  input: CreateEventRequest,
  options: IngestOptions = {}
): Promise<IngestResult> {
  const parsed = createEventRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid event payload", {
      issues: parsed.error.issues
    });
  }

  await ensureSiteExists(db, input.siteId);

  if (input.sourceSiteEventId) {
    const deduped = await db
      .select({ id: eventLog.id, sequenceNumber: eventLog.sequenceNumber })
      .from(eventLog)
      .where(
        and(
          eq(eventLog.siteId, input.siteId),
          eq(eventLog.sourceSiteEventId, input.sourceSiteEventId)
        )
      )
      .limit(1);

    if (deduped[0]) {
      incrementCounter("eventsDeduplicated");
      return {
        eventId: deduped[0].id,
        sequenceNumber: deduped[0].sequenceNumber,
        deduplicated: true
      };
    }
  }

  const occurredAt = new Date(input.occurredAt);

  const [inserted] = await db
    .insert(eventLog)
    .values({
      id: randomUUID(),
      eventType: input.eventType,
      assetId: input.assetId ?? null,
      siteId: input.siteId,
      transferOrderId: input.transferOrderId ?? null,
      syncBatchId: options.syncBatchId ?? null,
      sourceSiteEventId: input.sourceSiteEventId ?? null,
      occurredAt,
      payload: input.payload
    })
    .returning({
      id: eventLog.id,
      sequenceNumber: eventLog.sequenceNumber
    });

  await applyEventSideEffects(db, input, inserted.id, occurredAt);
  await updateProjectionFromEvent(db, input, inserted.id, inserted.sequenceNumber);
  incrementCounter("eventsIngested");

  return {
    eventId: inserted.id,
    sequenceNumber: inserted.sequenceNumber,
    deduplicated: false
  };
}

type ReplayInput = {
  siteId: string;
  syncBatchId: string;
  events: CreateEventRequest[];
};

export async function ingestSyncReplay(
  db: Database,
  input: ReplayInput
): Promise<{
  syncBatchId: string;
  acceptedEventCount: number;
  rejectedEventCount: number;
}> {
  const startedAt = new Date();
  await ingestEvent(db, {
    eventType: "site_sync_started",
    siteId: input.siteId,
    assetId: null,
    transferOrderId: null,
    occurredAt: startedAt.toISOString(),
    sourceSiteEventId: `${input.syncBatchId}:start`,
    payload: {
      syncBatchId: input.syncBatchId,
      queuedEventCount: input.events.length
    }
  });

  let acceptedEventCount = 0;
  let rejectedEventCount = 0;

  for (let index = 0; index < input.events.length; index += 1) {
    const event = input.events[index];
    try {
      const result = await ingestEvent(
        db,
        {
          ...event,
          sourceSiteEventId:
            event.sourceSiteEventId ?? `${input.syncBatchId}:event:${String(index)}`
        },
        { syncBatchId: input.syncBatchId }
      );
      if (result.deduplicated) {
        acceptedEventCount += 1;
      } else {
        acceptedEventCount += 1;
      }
    } catch {
      rejectedEventCount += 1;
    }
  }

  await ingestEvent(db, {
    eventType: "site_sync_completed",
    siteId: input.siteId,
    assetId: null,
    transferOrderId: null,
    occurredAt: new Date().toISOString(),
    sourceSiteEventId: `${input.syncBatchId}:complete`,
    payload: {
      syncBatchId: input.syncBatchId,
      acceptedEventCount,
      rejectedEventCount
    }
  });

  incrementCounter("syncReplayAccepted", acceptedEventCount);
  incrementCounter("syncReplayRejected", rejectedEventCount);

  return {
    syncBatchId: input.syncBatchId,
    acceptedEventCount,
    rejectedEventCount
  };
}

export async function fetchEventsForAsset(db: Database, assetId: string): Promise<DomainEvent[]> {
  const rows = await db
    .select()
    .from(eventLog)
    .where(eq(eventLog.assetId, assetId))
    .orderBy(desc(eventLog.sequenceNumber));

  return rows.map((row) => ({
    eventId: row.id,
    eventType: row.eventType as DomainEvent["eventType"],
    sequenceNumber: row.sequenceNumber,
    assetId: row.assetId,
    siteId: row.siteId,
    transferOrderId: row.transferOrderId,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload as Record<string, unknown>
  }));
}

export async function fetchLatestEventSequence(db: Database, assetId: string): Promise<number | null> {
  const rows = await db
    .select({ sequenceNumber: eventLog.sequenceNumber })
    .from(eventLog)
    .where(and(eq(eventLog.assetId, assetId), isNull(eventLog.syncBatchId)))
    .orderBy(desc(eventLog.sequenceNumber))
    .limit(1);

  return rows[0]?.sequenceNumber ?? null;
}
