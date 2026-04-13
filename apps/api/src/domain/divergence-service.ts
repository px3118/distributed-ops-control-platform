import {
  detectDualSiteObservations,
  detectInspectionEvidenceGaps,
  detectProjectionIntegrityIssues,
  detectStaleSites,
  detectTransferTimeouts,
  type DivergenceRuleResult
} from "@ops/domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { db as databaseClient } from "../db/client";
import {
  alerts,
  eventLog,
  reconciliationCases,
  sites,
  transferOrders
} from "../db/schema";
import { env } from "../lib/env";
import { incrementCounter } from "../lib/metrics";

type Database = typeof databaseClient;

function reconciliationTitleForRule(ruleCode: string): string {
  const labels: Record<string, string> = {
    TRANSFER_NOT_CONFIRMED: "Transfer confirmation overdue",
    ASSET_OBSERVED_AT_MULTIPLE_SITES: "Conflicting site observations",
    PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM: "Projection lag detected"
  };
  return labels[ruleCode] ?? "Divergence requires operator review";
}

async function loadTransferFindings(db: Database, now: Date): Promise<DivergenceRuleResult[]> {
  const rows = await db.select().from(transferOrders).where(eq(transferOrders.status, "initiated"));
  return detectTransferTimeouts(
    rows.map((row) => ({
      transferOrderId: row.id,
      assetId: row.assetId,
      originSiteId: row.originSiteId,
      destinationSiteId: row.destinationSiteId,
      status: row.status as "initiated" | "completed",
      initiatedAt: row.initiatedAt,
      completedAt: row.completedAt
    })),
    now,
    env.TRANSFER_CONFIRMATION_HOURS
  );
}

async function loadDualObservationFindings(db: Database): Promise<DivergenceRuleResult[]> {
  const rows = await db.execute(sql`
    select e.asset_id as asset_id, e.site_id as site_id, max(e.occurred_at) as observed_at
    from event_log e
    where e.event_type in ('asset_received', 'inspection_recorded')
      and e.asset_id is not null
    group by e.asset_id, e.site_id
  `);

  const observations = rows.rows.map((row) => ({
    assetId: String(row.asset_id),
    siteId: String(row.site_id),
    observedAt: new Date(String(row.observed_at))
  }));

  return detectDualSiteObservations(observations);
}

async function loadEvidenceFindings(db: Database): Promise<DivergenceRuleResult[]> {
  const rows = await db.execute(sql`
    select i.id as inspection_id, i.asset_id as asset_id, i.site_id as site_id,
      count(em.id) as evidence_count
    from inspection i
    left join evidence_metadata em on em.inspection_id = i.id
    group by i.id, i.asset_id, i.site_id
  `);

  return detectInspectionEvidenceGaps(
    rows.rows.map((row) => ({
      inspectionId: String(row.inspection_id),
      assetId: String(row.asset_id),
      siteId: String(row.site_id),
      evidenceCount: Number(row.evidence_count)
    }))
  );
}

async function loadStaleSiteFindings(db: Database, now: Date): Promise<DivergenceRuleResult[]> {
  const rows = await db.select().from(sites);

  return detectStaleSites(
    rows.map((row) => ({
      siteId: row.id,
      siteName: row.name,
      lastSyncCompletedAt: row.lastSyncCompletedAt,
      staleAfterMinutes: env.SYNC_STALE_MINUTES
    })),
    now
  );
}

async function loadProjectionIntegrityFindings(db: Database): Promise<DivergenceRuleResult[]> {
  const rows = await db.execute(sql`
    select p.asset_id as asset_id,
           p.last_sequence as projection_sequence,
           max(e.sequence_number) as latest_event_sequence
    from asset_projection p
    join event_log e on e.asset_id = p.asset_id
    group by p.asset_id, p.last_sequence
  `);

  return detectProjectionIntegrityIssues(
    rows.rows.map((row) => ({
      assetId: String(row.asset_id),
      projectionSequence: Number(row.projection_sequence),
      latestEventSequence: Number(row.latest_event_sequence)
    }))
  );
}

async function insertAlertIfNew(
  db: Database,
  finding: DivergenceRuleResult
): Promise<string | null> {
  const existingCondition = and(
    eq(alerts.ruleCode, finding.ruleCode),
    eq(alerts.status, "open"),
    finding.assetId ? eq(alerts.assetId, finding.assetId) : isNull(alerts.assetId),
    finding.siteId ? eq(alerts.siteId, finding.siteId) : isNull(alerts.siteId)
  );

  const existing = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(existingCondition)
    .limit(1);

  if (existing[0]) {
    await db
      .update(alerts)
      .set({
        severity: finding.severity,
        summary: finding.summary,
        details: finding.details
      })
      .where(existingCondition);
    return null;
  }

  const alertId = randomUUID();

  await db.insert(alerts).values({
    id: alertId,
    ruleCode: finding.ruleCode,
    severity: finding.severity,
    status: "open",
    assetId: finding.assetId,
    siteId: finding.siteId,
    summary: finding.summary,
    details: finding.details,
    detectedAt: new Date()
  });

  const defaultSite = finding.siteId
    ? finding.siteId
    : (
        await db.select({ id: sites.id }).from(sites).limit(1)
      )[0]?.id;

  if (defaultSite) {
    await db.insert(eventLog).values({
      id: randomUUID(),
      eventType: "divergence_detected",
      assetId: finding.assetId,
      siteId: defaultSite,
      transferOrderId: null,
      syncBatchId: null,
      sourceSiteEventId: null,
      occurredAt: new Date(),
      payload: {
        ruleCode: finding.ruleCode,
        severity: finding.severity,
        summary: finding.summary
      }
    });
  }

  if (finding.severity === "high") {
    await db.insert(reconciliationCases).values({
      id: randomUUID(),
      alertId,
      assetId: finding.assetId,
      siteId: finding.siteId,
      status: "open",
      title: reconciliationTitleForRule(finding.ruleCode),
      description: finding.summary,
      openedBy: "divergence-engine",
      openedAt: new Date()
    });
  }

  return alertId;
}

export async function runDivergenceScan(db: Database): Promise<{
  findingsEvaluated: number;
  alertsCreated: number;
}> {
  incrementCounter("divergenceScans");
  const now = new Date();

  const [transferFindings, dualSiteFindings, evidenceFindings, staleSiteFindings, projectionFindings] =
    await Promise.all([
      loadTransferFindings(db, now),
      loadDualObservationFindings(db),
      loadEvidenceFindings(db),
      loadStaleSiteFindings(db, now),
      loadProjectionIntegrityFindings(db)
    ]);

  const combined = [
    ...transferFindings,
    ...dualSiteFindings,
    ...evidenceFindings,
    ...staleSiteFindings,
    ...projectionFindings
  ];

  let alertsCreated = 0;

  for (const finding of combined) {
    const inserted = await insertAlertIfNew(db, finding);
    if (inserted) {
      alertsCreated += 1;
    }
  }

  return {
    findingsEvaluated: combined.length,
    alertsCreated
  };
}
