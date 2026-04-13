export type DivergenceRuleResult = {
  ruleCode: string;
  severity: "low" | "medium" | "high";
  assetId: string | null;
  siteId: string | null;
  summary: string;
  details: Record<string, unknown>;
};

export type TransferRecord = {
  transferOrderId: string;
  assetId: string;
  originSiteId: string;
  destinationSiteId: string;
  status: "initiated" | "completed";
  initiatedAt: Date;
  completedAt: Date | null;
};

export type AssetObservation = {
  assetId: string;
  siteId: string;
  observedAt: Date;
};

export type InspectionEvidenceGap = {
  inspectionId: string;
  assetId: string;
  siteId: string;
  evidenceCount: number;
};

export type SiteStaleness = {
  siteId: string;
  siteName: string;
  lastSyncCompletedAt: Date | null;
  staleAfterMinutes: number;
};

export type ProjectionIntegrityIssue = {
  assetId: string;
  projectionSequence: number;
  latestEventSequence: number;
};

export function detectTransferTimeouts(
  transfers: TransferRecord[],
  now: Date,
  timeoutHours: number
): DivergenceRuleResult[] {
  return transfers
    .filter((transfer) => transfer.status === "initiated")
    .filter((transfer) => {
      const hours = (now.getTime() - transfer.initiatedAt.getTime()) / (1000 * 60 * 60);
      return hours > timeoutHours;
    })
    .map((transfer) => ({
      ruleCode: "TRANSFER_NOT_CONFIRMED",
      severity: "high",
      assetId: transfer.assetId,
      siteId: transfer.originSiteId,
      summary: "Transfer confirmation overdue",
      details: {
        transferOrderId: transfer.transferOrderId,
        timeoutHours,
        initiatedAt: transfer.initiatedAt.toISOString(),
        destinationSiteId: transfer.destinationSiteId
      }
    }));
}

export function detectDualSiteObservations(
  observations: AssetObservation[]
): DivergenceRuleResult[] {
  const byAsset = new Map<string, AssetObservation[]>();
  for (const observation of observations) {
    const list = byAsset.get(observation.assetId) ?? [];
    list.push(observation);
    byAsset.set(observation.assetId, list);
  }

  const findings: DivergenceRuleResult[] = [];

  for (const [assetId, assetObservations] of byAsset.entries()) {
    const siteSet = new Set(assetObservations.map((record) => record.siteId));
    if (siteSet.size > 1) {
      findings.push({
        ruleCode: "ASSET_OBSERVED_AT_MULTIPLE_SITES",
        severity: "high",
        assetId,
        siteId: null,
        summary: "Conflicting site observations",
        details: {
          observations: assetObservations.map((record) => ({
            siteId: record.siteId,
            observedAt: record.observedAt.toISOString()
          }))
        }
      });
    }
  }

  return findings;
}

export function detectInspectionEvidenceGaps(
  gaps: InspectionEvidenceGap[]
): DivergenceRuleResult[] {
  return gaps
    .filter((gap) => gap.evidenceCount === 0)
    .map((gap) => ({
      ruleCode: "INSPECTION_MISSING_EVIDENCE",
      severity: "medium",
      assetId: gap.assetId,
      siteId: gap.siteId,
      summary: "Inspection evidence missing",
      details: {
        inspectionId: gap.inspectionId
      }
    }));
}

export function detectStaleSites(
  sites: SiteStaleness[],
  now: Date
): DivergenceRuleResult[] {
  return sites
    .filter((site) => {
      if (!site.lastSyncCompletedAt) {
        return true;
      }
      const ageMinutes =
        (now.getTime() - site.lastSyncCompletedAt.getTime()) / (1000 * 60);
      return ageMinutes > site.staleAfterMinutes;
    })
    .map((site) => ({
      ruleCode: "SITE_PROJECTION_STALE",
      severity: "medium",
      assetId: null,
      siteId: site.siteId,
      summary: "Site sync stale",
      details: {
        siteName: site.siteName,
        lastSyncCompletedAt: site.lastSyncCompletedAt?.toISOString() ?? null,
        staleAfterMinutes: site.staleAfterMinutes
      }
    }));
}

export function detectProjectionIntegrityIssues(
  issues: ProjectionIntegrityIssue[]
): DivergenceRuleResult[] {
  return issues
    .filter((issue) => issue.projectionSequence < issue.latestEventSequence)
    .map((issue) => ({
      ruleCode: "PROJECTION_SEQUENCE_BEHIND_EVENT_STREAM",
      severity: "high",
      assetId: issue.assetId,
      siteId: null,
      summary: "Projection lag detected",
      details: {
        projectionSequence: issue.projectionSequence,
        latestEventSequence: issue.latestEventSequence
      }
    }));
}
