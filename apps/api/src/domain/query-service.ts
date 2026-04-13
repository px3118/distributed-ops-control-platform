import { count, desc, eq, sql } from "drizzle-orm";
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

export async function listSites(db: Database): Promise<unknown[]> {
  const rows = await db.select().from(sites).orderBy(sites.code);
  return rows.map((row) => ({
    ...row,
    syncHealth: computeSyncHealth(row.lastSyncCompletedAt)
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

  const [timeline, inspectionsRows, evidenceRows] = await Promise.all([
    db
      .select()
      .from(eventLog)
      .where(eq(eventLog.assetId, assetId))
      .orderBy(desc(eventLog.sequenceNumber)),
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
    `)
  ]);

  return {
    projection,
    timeline,
    inspections: inspectionsRows.rows,
    evidenceMetadata: evidenceRows.rows
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
        select id, sequence_number, event_type, site_id, sync_batch_id, occurred_at, payload
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

  return {
    transfer,
    overdue,
    originSite: originSite[0] ?? null,
    destinationSite: destinationSite[0] ?? null,
    projection: projection[0] ?? null,
    relatedEvents: eventsRows.rows,
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
      select id, sequence_number, event_type, asset_id, site_id, occurred_at, source_site_event_id, payload
      from event_log
      where sync_batch_id = ${syncBatchId}
      order by sequence_number asc
    `)
  ]);

  return {
    batch,
    site: site[0] ?? null,
    replayedEvents: replayedEventsRows.rows,
    replayDiagnostics: {
      idempotencyModel: "Deduplication enforced by unique (site_id, source_site_event_id) during ingestion.",
      rejectionReasons:
        batch.rejectedEventCount > 0
          ? ["Event-level rejection reasons are not persisted in v1; batch counts are retained."]
          : []
    }
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
      select id, sequence_number, event_type, asset_id, occurred_at
      from event_log
      where site_id = ${siteId}
      order by sequence_number desc
      limit 30
    `)
  ]);

  return {
    site: {
      ...site,
      syncHealth: computeSyncHealth(site.lastSyncCompletedAt)
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
      select id, sequence_number, event_type, site_id, transfer_order_id, sync_batch_id, occurred_at, payload
      from event_log
      where (payload ->> 'caseId' = ${caseId}) ${
        caseRow.assetId ? sql`or asset_id = ${caseRow.assetId}` : sql``
      }
      order by sequence_number desc
      limit 40
    `)
  ]);

  return {
    case: caseRow,
    sourceAlert: alertRow[0] ?? null,
    projection: projectionRow[0] ?? null,
    relatedEvents: relatedEventsRows.rows
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
