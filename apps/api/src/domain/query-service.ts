import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { db as databaseClient } from "../db/client";
import {
  alerts,
  assetProjection,
  eventLog,
  reconciliationCases,
  sites,
  syncBatches,
  transferOrders
} from "../db/schema";
import { env } from "../lib/env";
import { ApiError } from "../lib/errors";

type Database = typeof databaseClient;

function computeSyncHealth(lastSyncCompletedAt: Date | null): "healthy" | "stale" {
  if (!lastSyncCompletedAt) {
    return "stale";
  }

  const ageMinutes = (Date.now() - lastSyncCompletedAt.getTime()) / (1000 * 60);
  return ageMinutes > env.SYNC_STALE_MINUTES ? "stale" : "healthy";
}

function computeSyncPosture(input: {
  lastSyncCompletedAt: Date | null;
  latestBatch:
    | {
        status: string;
        startedAt: Date;
        rejectedEventCount: number;
      }
    | null;
}): "healthy" | "stale" | "degraded" {
  const baseHealth = computeSyncHealth(input.lastSyncCompletedAt);
  if (baseHealth === "stale") {
    return "stale";
  }

  if (!input.latestBatch) {
    return "healthy";
  }

  const minutesSinceBatchStart =
    (Date.now() - input.latestBatch.startedAt.getTime()) / (1000 * 60);
  const recentlyReplayed = minutesSinceBatchStart <= env.SYNC_STALE_MINUTES;
  const hasReplayWarnings =
    input.latestBatch.status !== "completed" || input.latestBatch.rejectedEventCount > 0;

  if (recentlyReplayed && hasReplayWarnings) {
    return "degraded";
  }

  return "healthy";
}

function parseReplayDiagnostics(
  replayResultSummary: string | null,
  rejectedEventCount: number
): {
  idempotencyModel: string;
  deduplicatedEventCount: number;
  rejectionReasons: string[];
} {
  const fallback = {
    idempotencyModel:
      "Replay uses source-site deduplication key (site_id, source_site_event_id). Duplicate events are accepted without duplicate side effects.",
    deduplicatedEventCount: 0,
    rejectionReasons:
      rejectedEventCount > 0
        ? ["One or more events were rejected during replay; inspect batch event timeline for context."]
        : []
  };

  if (!replayResultSummary) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(replayResultSummary) as {
      idempotencyModel?: string;
      deduplicatedEventCount?: number;
      rejectionReasons?: string[];
    };

    return {
      idempotencyModel: parsed.idempotencyModel ?? fallback.idempotencyModel,
      deduplicatedEventCount:
        typeof parsed.deduplicatedEventCount === "number"
          ? parsed.deduplicatedEventCount
          : fallback.deduplicatedEventCount,
      rejectionReasons:
        Array.isArray(parsed.rejectionReasons) && parsed.rejectionReasons.length > 0
          ? parsed.rejectionReasons
          : fallback.rejectionReasons
    };
  } catch {
    return fallback;
  }
}

export async function listSites(db: Database): Promise<unknown[]> {
  const [rows, latestBatchRows] = await Promise.all([
    db.select().from(sites).orderBy(sites.code),
    db.select().from(syncBatches).orderBy(desc(syncBatches.startedAt))
  ]);

  const latestBatchBySiteId = new Map<string, (typeof latestBatchRows)[number]>();
  for (const batch of latestBatchRows) {
    if (!latestBatchBySiteId.has(batch.siteId)) {
      latestBatchBySiteId.set(batch.siteId, batch);
    }
  }

  return rows.map((row) => ({
    ...row,
    syncHealth: computeSyncHealth(row.lastSyncCompletedAt),
    syncPosture: computeSyncPosture({
      lastSyncCompletedAt: row.lastSyncCompletedAt,
      latestBatch: latestBatchBySiteId.get(row.id) ?? null
    })
  }));
}

export async function listAssets(db: Database): Promise<unknown[]> {
  return db
    .select({
      assetId: assetProjection.assetId,
      serialNumber: assetProjection.serialNumber,
      currentSiteId: assetProjection.currentSiteId,
      status: assetProjection.status,
      lastEventType: assetProjection.lastEventType,
      lastEventAt: assetProjection.lastEventAt,
      lastSequence: assetProjection.lastSequence,
      version: assetProjection.version
    })
    .from(assetProjection)
    .orderBy(desc(assetProjection.lastEventAt));
}

export async function getAssetById(db: Database, assetId: string): Promise<unknown | null> {
  const [projection] = await db
    .select()
    .from(assetProjection)
    .where(eq(assetProjection.assetId, assetId))
    .limit(1);

  if (!projection) {
    return null;
  }

  const [timelineRows, inspectionsRows, evidenceRows, alertRows, transferRows, caseRows] = await Promise.all([
    db
      .execute(sql`
        select id, sequence_number, event_type, site_id, transfer_order_id, sync_batch_id, source_site_event_id, occurred_at, ingested_at, payload
        from event_log
        where asset_id = ${assetId}
        order by sequence_number desc
      `),
    db.execute(sql`
      select i.id, i.status, i.notes, i.inspected_at,
             count(em.id) as evidence_count
      from inspection i
      left join evidence_metadata em on em.inspection_id = i.id
      where i.asset_id = ${assetId}
      group by i.id, i.status, i.notes, i.inspected_at
      order by i.inspected_at desc
    `),
    db.execute(sql`
      select em.id, em.inspection_id, em.mime_type, em.sha256, em.storage_ref, em.recorded_at
      from evidence_metadata em
      join inspection i on i.id = em.inspection_id
      where i.asset_id = ${assetId}
      order by em.recorded_at desc
    `),
    db.execute(sql`
      select id, rule_code, severity, status, summary, details, detected_at
      from alert
      where asset_id = ${assetId}
      order by detected_at desc
      limit 20
    `),
    db
      .select()
      .from(transferOrders)
      .where(eq(transferOrders.assetId, assetId))
      .orderBy(desc(transferOrders.initiatedAt))
      .limit(20),
    db
      .select()
      .from(reconciliationCases)
      .where(eq(reconciliationCases.assetId, assetId))
      .orderBy(desc(reconciliationCases.openedAt))
      .limit(20)
  ]);

  const timeline = timelineRows.rows as Array<{
    id: string;
    sequence_number: number;
    event_type: string;
    site_id: string;
    transfer_order_id: string | null;
    sync_batch_id: string | null;
    source_site_event_id: string | null;
    occurred_at: string;
    ingested_at: string;
    payload: Record<string, unknown>;
  }>;

  const latestAcceptedEventSequence = timeline[0]
    ? Number(timeline[0].sequence_number)
    : projection.lastSequence;
  const projectionLag = Math.max(0, latestAcceptedEventSequence - projection.lastSequence);

  const siteIdsInTimeline = Array.from(new Set(timeline.map((event) => event.site_id)));
  const syncBatchIds = Array.from(
    new Set(
      timeline
        .map((event) => event.sync_batch_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const [siteRows, relatedSyncBatches] = await Promise.all([
    siteIdsInTimeline.length > 0
      ? db.select().from(sites).where(inArray(sites.id, siteIdsInTimeline))
      : Promise.resolve([]),
    syncBatchIds.length > 0
      ? db.select().from(syncBatches).where(inArray(syncBatches.id, syncBatchIds))
      : Promise.resolve([])
  ]);

  const hasPendingReplay = relatedSyncBatches.some((batch) => batch.status !== "completed");
  const hasRejectedReplay = relatedSyncBatches.some((batch) => batch.rejectedEventCount > 0);
  const hasStaleSite = siteRows.some((site) => computeSyncHealth(site.lastSyncCompletedAt) === "stale");
  const projectionLagAlert = alertRows.rows.find(
    (row) => String(row.rule_code) === "PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM"
  );

  const projectionLagReason =
    projectionLag > 0
      ? hasPendingReplay
        ? "Projection is behind because one or more replay batches for this asset are still in progress."
        : hasRejectedReplay
          ? "Projection is behind because one or more replayed events were rejected and require operator review."
          : hasStaleSite
            ? "Projection is behind because at least one source site is stale and has not completed sync within threshold."
            : "Projection is behind because accepted events are ahead of the current projection reducer position."
      : "Projection is aligned with the accepted event stream.";

  const projectionLagTriggerSummary =
    projectionLagAlert && typeof projectionLagAlert.summary === "string"
      ? projectionLagAlert.summary
      : null;
  const orderedRelatedSyncBatches = [...relatedSyncBatches].sort(
    (left, right) => right.startedAt.getTime() - left.startedAt.getTime()
  );

  return {
    projection,
    projectionState: {
      currentStatus: projection.status,
      lastProjectionSequence: projection.lastSequence,
      lastAcceptedEventSequence: latestAcceptedEventSequence,
      projectionBehindStream: projection.lastSequence < latestAcceptedEventSequence,
      projectionLag,
      hasPendingReplay,
      hasRejectedReplay,
      hasStaleSite,
      lagReason: projectionLagReason,
      lagTriggeredBy: projectionLagTriggerSummary
    },
    timeline,
    inspections: inspectionsRows.rows,
    evidenceMetadata: evidenceRows.rows,
    divergenceReasons: alertRows.rows,
    relatedTransfers: transferRows,
    relatedCases: caseRows,
    relatedSyncBatches: orderedRelatedSyncBatches
  };
}

export async function getTransferById(db: Database, transferId: string): Promise<unknown | null> {
  const [transfer] = await db
    .select()
    .from(transferOrders)
    .where(eq(transferOrders.id, transferId))
    .limit(1);

  if (!transfer) {
    return null;
  }

  const [originSite, destinationSite, projection, eventsRows, alertRows, caseRows] =
    await Promise.all([
      db.select().from(sites).where(eq(sites.id, transfer.originSiteId)).limit(1),
      db.select().from(sites).where(eq(sites.id, transfer.destinationSiteId)).limit(1),
      db
        .select()
        .from(assetProjection)
        .where(eq(assetProjection.assetId, transfer.assetId))
        .limit(1),
      db.execute(sql`
        select id, sequence_number, event_type, site_id, sync_batch_id, source_site_event_id, occurred_at, ingested_at, payload
        from event_log
        where transfer_order_id = ${transferId}
        order by sequence_number desc
      `),
      db.execute(sql`
        select id, rule_code, severity, status, summary, detected_at
        from alert
        where asset_id = ${transfer.assetId}
        order by detected_at desc
        limit 20
      `),
      db.execute(sql`
        select id, status, title, opened_at, resolved_at
        from reconciliation_case
        where asset_id = ${transfer.assetId}
        order by opened_at desc
        limit 20
      `)
    ]);

  const overdue =
    transfer.status !== "completed" &&
    (Date.now() - transfer.initiatedAt.getTime()) / (1000 * 60 * 60) > env.TRANSFER_CONFIRMATION_HOURS;

  const relatedEvents = eventsRows.rows as Array<{
    id: string;
    sequence_number: number;
    event_type: string;
    site_id: string;
    sync_batch_id: string | null;
    source_site_event_id: string | null;
    occurred_at: string;
    ingested_at: string;
    payload: Record<string, unknown>;
  }>;

  const latestAcceptedEventSequence = relatedEvents[0]
    ? Number(relatedEvents[0].sequence_number)
    : (projection[0]?.lastSequence ?? 0);
  const lastProjectionSequence = projection[0]?.lastSequence ?? 0;
  const relatedSyncBatchIds = Array.from(
    new Set(
      relatedEvents
        .map((event) => event.sync_batch_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  const relatedSiteIds = Array.from(new Set(relatedEvents.map((event) => event.site_id)));
  const [linkedSyncBatches, relatedSites] = await Promise.all([
    relatedSyncBatchIds.length > 0
      ? db.select().from(syncBatches).where(inArray(syncBatches.id, relatedSyncBatchIds))
      : Promise.resolve([]),
    relatedSiteIds.length > 0
      ? db.select().from(sites).where(inArray(sites.id, relatedSiteIds))
      : Promise.resolve([])
  ]);
  const hasPendingReplay = linkedSyncBatches.some((batch) => batch.status !== "completed");
  const hasRejectedReplay = linkedSyncBatches.some((batch) => batch.rejectedEventCount > 0);
  const hasStaleSite = relatedSites.some((site) => computeSyncHealth(site.lastSyncCompletedAt) === "stale");
  const projectionLag = Math.max(0, latestAcceptedEventSequence - lastProjectionSequence);
  const projectionLagAlert = alertRows.rows.find(
    (row) => String(row.rule_code) === "PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM"
  );
  const lagReason =
    projectionLag > 0
      ? hasPendingReplay
        ? "Projection is behind because one or more linked replay batches are still in progress."
        : hasRejectedReplay
          ? "Projection is behind because one or more linked replay events were rejected."
          : hasStaleSite
            ? "Projection is behind because one or more linked sites are stale."
            : "Projection is behind because accepted events are ahead of the current projection sequence."
      : "Projection is aligned with accepted event stream.";
  const orderedLinkedSyncBatches = [...linkedSyncBatches].sort(
    (left, right) => right.startedAt.getTime() - left.startedAt.getTime()
  );

  return {
    transfer,
    overdue,
    originSite: originSite[0] ?? null,
    destinationSite: destinationSite[0] ?? null,
    projection: projection[0] ?? null,
    projectionState: projection[0]
      ? {
          currentStatus: projection[0].status,
          lastProjectionSequence,
          lastAcceptedEventSequence: latestAcceptedEventSequence,
          projectionBehindStream: lastProjectionSequence < latestAcceptedEventSequence,
          projectionLag,
          hasPendingReplay,
          hasRejectedReplay,
          hasStaleSite,
          lagReason,
          lagTriggeredBy:
            projectionLagAlert && typeof projectionLagAlert.summary === "string"
              ? projectionLagAlert.summary
              : null
        }
      : null,
    relatedEvents,
    linkedSyncBatches: orderedLinkedSyncBatches,
    relatedAlerts: alertRows.rows,
    relatedCases: caseRows.rows
  };
}

export async function getSyncBatchById(db: Database, syncBatchId: string): Promise<unknown | null> {
  const [batch] = await db
    .select()
    .from(syncBatches)
    .where(eq(syncBatches.id, syncBatchId))
    .limit(1);

  if (!batch) {
    return null;
  }

  const [site, replayedEventsRows] = await Promise.all([
    db.select().from(sites).where(eq(sites.id, batch.siteId)).limit(1),
    db.execute(sql`
      select id, sequence_number, event_type, asset_id, site_id, occurred_at, ingested_at, source_site_event_id, payload
      from event_log
      where sync_batch_id = ${syncBatchId}
      order by sequence_number asc
    `)
  ]);

  const replayedEvents = replayedEventsRows.rows as Array<{
    id: string;
    sequence_number: number;
    event_type: string;
    asset_id: string | null;
    site_id: string;
    occurred_at: string;
    ingested_at: string;
    source_site_event_id: string | null;
    payload: Record<string, unknown>;
  }>;
  const replayDiagnostics = parseReplayDiagnostics(batch.replayResultSummary, batch.rejectedEventCount);
  const affectedAssetIds = new Set(replayedEvents.map((event) => event.asset_id).filter(Boolean));

  return {
    batch,
    site: site[0] ?? null,
    replayedEvents,
    replayDiagnostics,
    affectedAssets: Array.from(affectedAssetIds),
    affectedEventTypes: Array.from(new Set(replayedEvents.map((event) => event.event_type)))
  };
}

export async function getSiteById(db: Database, siteId: string): Promise<unknown | null> {
  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return null;
  }

  const [recentBatchesRows, projectedAssetsRows, alertRows, eventRows] = await Promise.all([
    db
      .select()
      .from(syncBatches)
      .where(eq(syncBatches.siteId, siteId))
      .orderBy(desc(syncBatches.startedAt))
      .limit(20),
    db.execute(sql`
      select asset_id, serial_number, status, last_event_type, last_event_at, last_sequence
      from asset_projection
      where current_site_id = ${siteId}
      order by last_event_at desc
      limit 50
    `),
    db.execute(sql`
      select id, rule_code, severity, status, summary, detected_at
      from alert
      where site_id = ${siteId}
      order by detected_at desc
      limit 30
    `),
    db.execute(sql`
      select id, sequence_number, event_type, asset_id, sync_batch_id, source_site_event_id, occurred_at, ingested_at, payload
      from event_log
      where site_id = ${siteId}
      order by sequence_number desc
      limit 30
    `)
  ]);

  return {
    site: {
      ...site,
      syncHealth: computeSyncHealth(site.lastSyncCompletedAt),
      syncPosture: computeSyncPosture({
        lastSyncCompletedAt: site.lastSyncCompletedAt,
        latestBatch:
          recentBatchesRows[0] ?? null
      })
    },
    staleThresholdMinutes: env.SYNC_STALE_MINUTES,
    recentSyncBatches: recentBatchesRows,
    projectedAssets: projectedAssetsRows.rows,
    recentAlerts: alertRows.rows,
    recentEvents: eventRows.rows
  };
}

export async function getReconciliationCaseById(
  db: Database,
  caseId: string
): Promise<unknown | null> {
  const [caseRow] = await db
    .select()
    .from(reconciliationCases)
    .where(eq(reconciliationCases.id, caseId))
    .limit(1);

  if (!caseRow) {
    return null;
  }

  const [alertRow, projectionRow, relatedEventsRows] = await Promise.all([
    caseRow.alertId
      ? db.select().from(alerts).where(eq(alerts.id, caseRow.alertId)).limit(1)
      : Promise.resolve([]),
    caseRow.assetId
      ? db
          .select()
          .from(assetProjection)
          .where(eq(assetProjection.assetId, caseRow.assetId))
          .limit(1)
      : Promise.resolve([]),
    db.execute(sql`
      select id, sequence_number, event_type, site_id, transfer_order_id, sync_batch_id, source_site_event_id, occurred_at, ingested_at, payload
      from event_log
      where (payload ->> 'caseId' = ${caseId}) ${
        caseRow.assetId ? sql`or asset_id = ${caseRow.assetId}` : sql``
      }
      order by sequence_number desc
      limit 40
    `)
  ]);

  const relatedEvents = relatedEventsRows.rows as Array<{
    id: string;
    sequence_number: number;
    event_type: string;
    site_id: string;
    transfer_order_id: string | null;
    sync_batch_id: string | null;
    source_site_event_id: string | null;
    occurred_at: string;
    ingested_at: string;
    payload: Record<string, unknown>;
  }>;
  const eventSiteIds = Array.from(new Set(relatedEvents.map((event) => event.site_id)));
  const relatedSyncBatchIds = Array.from(
    new Set(
      relatedEvents
        .map((event) => event.sync_batch_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  const [siteRows, linkedSyncBatches] = await Promise.all([
    eventSiteIds.length > 0
      ? db.select().from(sites).where(inArray(sites.id, eventSiteIds))
      : Promise.resolve([]),
    relatedSyncBatchIds.length > 0
      ? db.select().from(syncBatches).where(inArray(syncBatches.id, relatedSyncBatchIds))
      : Promise.resolve([])
  ]);
  const latestAcceptedEventSequence = relatedEvents[0]
    ? Number(relatedEvents[0].sequence_number)
    : (projectionRow[0]?.lastSequence ?? 0);
  const lastProjectionSequence = projectionRow[0]?.lastSequence ?? 0;
  const linkedTransferId =
    relatedEvents.find((event) => event.transfer_order_id)?.transfer_order_id ?? null;
  const resolutionEvent =
    relatedEvents.find(
      (event) =>
        event.event_type === "reconciliation_resolved" &&
        String((event.payload as { caseId?: string }).caseId ?? "") === caseId
    ) ?? null;
  const hasPendingReplay = linkedSyncBatches.some((batch) => batch.status !== "completed");
  const hasRejectedReplay = linkedSyncBatches.some((batch) => batch.rejectedEventCount > 0);
  const hasStaleSite = siteRows.some((site) => computeSyncHealth(site.lastSyncCompletedAt) === "stale");
  const lagTriggeredBy =
    alertRow[0] && alertRow[0].ruleCode === "PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM"
      ? alertRow[0].summary
      : null;
  const lagReason =
    projectionRow[0] && projectionRow[0].lastSequence < latestAcceptedEventSequence
      ? hasPendingReplay
        ? "Projection lag is likely due to replay not yet completed for one or more linked batches."
        : hasRejectedReplay
          ? "Projection lag is likely due to one or more rejected replay events requiring operator action."
          : hasStaleSite
            ? "Projection lag is likely due to stale site sync across linked event sources."
            : "Projection lag indicates accepted events are ahead of current projection state."
      : "Projection is aligned with accepted event stream.";
  const orderedLinkedSyncBatches = [...linkedSyncBatches].sort(
    (left, right) => right.startedAt.getTime() - left.startedAt.getTime()
  );

  return {
    case: caseRow,
    sourceAlert: alertRow[0] ?? null,
    projection: projectionRow[0] ?? null,
    projectionState: projectionRow[0]
      ? {
          currentStatus: projectionRow[0].status,
          lastProjectionSequence,
          lastAcceptedEventSequence: latestAcceptedEventSequence,
          projectionBehindStream: lastProjectionSequence < latestAcceptedEventSequence,
          projectionLag: Math.max(0, latestAcceptedEventSequence - lastProjectionSequence),
          hasPendingReplay,
          hasRejectedReplay,
          hasStaleSite,
          lagReason,
          lagTriggeredBy
        }
      : null,
    linkedTransferId,
    linkedSyncBatches: orderedLinkedSyncBatches,
    operatorNoteHistory: [
      {
        type: "opened",
        recordedBy: caseRow.openedBy,
        recordedAt: caseRow.openedAt,
        note: caseRow.description
      },
      ...(caseRow.resolutionSummary && caseRow.resolvedBy && caseRow.resolvedAt
        ? [
            {
              type: "resolved",
              recordedBy: caseRow.resolvedBy,
              recordedAt: caseRow.resolvedAt,
              note: caseRow.resolutionSummary
            }
          ]
        : [])
    ],
    resolutionEvent,
    relatedEvents
  };
}

export async function listTransfers(db: Database): Promise<unknown[]> {
  return db.select().from(transferOrders).orderBy(desc(transferOrders.initiatedAt));
}

export async function listAlerts(db: Database): Promise<unknown[]> {
  return db.select().from(alerts).orderBy(desc(alerts.detectedAt));
}

export async function listReconciliationCases(db: Database): Promise<unknown[]> {
  return db.select().from(reconciliationCases).orderBy(desc(reconciliationCases.openedAt));
}

export async function listEvidenceMetadata(db: Database): Promise<unknown[]> {
  const rows = await db.execute(sql`
    select em.id, em.inspection_id, em.mime_type, em.sha256, em.storage_ref, em.recorded_at, i.asset_id
    from evidence_metadata em
    join inspection i on i.id = em.inspection_id
    order by em.recorded_at desc
  `);

  return rows.rows;
}

export async function openReconciliationCase(
  db: Database,
  input: {
    alertId?: string;
    assetId?: string;
    siteId?: string;
    title: string;
    description: string;
    openedBy: string;
  }
): Promise<unknown> {
  const [fallbackSite] = await db.select({ id: sites.id }).from(sites).limit(1);
  const siteId = input.siteId ?? fallbackSite?.id ?? null;
  if (!siteId) {
    throw new ApiError(400, "Cannot open reconciliation case without at least one site");
  }

  const id = randomUUID();
  await db.insert(reconciliationCases).values({
    id,
    alertId: input.alertId ?? null,
    assetId: input.assetId ?? null,
    siteId,
    title: input.title,
    description: input.description,
    openedBy: input.openedBy,
    status: "open",
    openedAt: new Date()
  });

  await db.insert(eventLog).values({
    id: randomUUID(),
    eventType: "reconciliation_opened",
    assetId: input.assetId ?? null,
    siteId,
    transferOrderId: null,
    syncBatchId: null,
    sourceSiteEventId: null,
    occurredAt: new Date(),
    payload: {
      caseId: id,
      alertId: input.alertId ?? randomUUID(),
      openedBy: input.openedBy
    }
  });

  const [created] = await db
    .select()
    .from(reconciliationCases)
    .where(eq(reconciliationCases.id, id))
    .limit(1);

  return created;
}

export async function resolveReconciliationCase(
  db: Database,
  caseId: string,
  input: { resolvedBy: string; resolutionSummary: string }
): Promise<unknown | null> {
  const [current] = await db
    .select()
    .from(reconciliationCases)
    .where(eq(reconciliationCases.id, caseId))
    .limit(1);
  if (!current) {
    return null;
  }

  await db
    .update(reconciliationCases)
    .set({
      status: "resolved",
      resolvedBy: input.resolvedBy,
      resolutionSummary: input.resolutionSummary,
      resolvedAt: new Date()
    })
    .where(eq(reconciliationCases.id, caseId));

  const [fallbackSite] = await db.select({ id: sites.id }).from(sites).limit(1);
  const siteId = current.siteId ?? fallbackSite?.id ?? null;

  if (siteId) {
    await db.insert(eventLog).values({
      id: randomUUID(),
      eventType: "reconciliation_resolved",
      assetId: current.assetId ?? null,
      siteId,
      transferOrderId: null,
      syncBatchId: null,
      sourceSiteEventId: null,
      occurredAt: new Date(),
      payload: {
        caseId,
        resolvedBy: input.resolvedBy,
        resolutionSummary: input.resolutionSummary
      }
    });
  }

  const [updated] = await db
    .select()
    .from(reconciliationCases)
    .where(eq(reconciliationCases.id, caseId))
    .limit(1);

  return updated ?? null;
}

export async function listSyncBatches(db: Database): Promise<unknown[]> {
  return db.select().from(syncBatches).orderBy(desc(syncBatches.startedAt));
}

export async function dashboardSummary(db: Database): Promise<Record<string, number>> {
  const [openCaseCount, staleSiteCount, inTransitCount, recentAlertCount, replayStats, evidenceGapCount] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(reconciliationCases)
        .where(eq(reconciliationCases.status, "open")),
      db.execute(sql`
        select count(*)::int as value
        from site
        where last_sync_completed_at is null
          or now() - last_sync_completed_at > (${env.SYNC_STALE_MINUTES} || ' minutes')::interval
      `),
      db
        .select({ value: count() })
        .from(assetProjection)
        .where(eq(assetProjection.status, "in_transit")),
      db.execute(sql`
        select count(*)::int as value
        from alert
        where detected_at > now() - interval '24 hours'
      `),
      db.execute(sql`
        select
          coalesce(sum(accepted_event_count), 0)::int as replay_success_count,
          coalesce(sum(rejected_event_count), 0)::int as replay_failure_count
        from sync_batch
        where started_at > now() - interval '24 hours'
      `),
      db.execute(sql`
        select count(*)::int as value
        from (
          select i.id
          from inspection i
          left join evidence_metadata em on em.inspection_id = i.id
          group by i.id
          having count(em.id) = 0
        ) gaps
      `)
    ]);

  return {
    openReconciliationCases: Number(openCaseCount[0]?.value ?? 0),
    staleSites: Number(staleSiteCount.rows[0]?.value ?? 0),
    assetsInTransit: Number(inTransitCount[0]?.value ?? 0),
    recentAlerts: Number(recentAlertCount.rows[0]?.value ?? 0),
    replaySuccessCount: Number(replayStats.rows[0]?.replay_success_count ?? 0),
    replayFailureCount: Number(replayStats.rows[0]?.replay_failure_count ?? 0),
    unresolvedEvidenceGaps: Number(evidenceGapCount.rows[0]?.value ?? 0)
  };
}

export async function recentTransfers(db: Database): Promise<unknown[]> {
  return db.select().from(transferOrders).orderBy(desc(transferOrders.initiatedAt)).limit(10);
}

export async function recentAlerts(db: Database): Promise<unknown[]> {
  return db.select().from(alerts).orderBy(desc(alerts.detectedAt)).limit(10);
}

export async function recentBatches(db: Database): Promise<unknown[]> {
  return db.select().from(syncBatches).orderBy(desc(syncBatches.startedAt)).limit(10);
}
