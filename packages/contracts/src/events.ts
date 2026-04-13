import { z } from "zod";

export const eventTypeSchema = z.enum([
  "asset_registered",
  "asset_moved",
  "asset_received",
  "inspection_recorded",
  "evidence_attached",
  "transfer_initiated",
  "transfer_completed",
  "site_sync_started",
  "site_sync_completed",
  "divergence_detected",
  "reconciliation_opened",
  "reconciliation_resolved"
]);

export type EventType = z.infer<typeof eventTypeSchema>;

export const baseEventSchema = z.object({
  eventType: eventTypeSchema,
  assetId: z.string().uuid().nullable().optional(),
  siteId: z.string().uuid(),
  transferOrderId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().datetime(),
  sourceSiteEventId: z.string().min(1).nullable().optional(),
  payload: z.record(z.string(), z.unknown())
});

export const assetRegisteredPayloadSchema = z.object({
  serialNumber: z.string().min(3),
  containerId: z.string().min(1).nullable().optional(),
  registeredBy: z.string().min(1)
});

export const assetMovedPayloadSchema = z.object({
  fromSiteId: z.string().uuid(),
  toSiteId: z.string().uuid(),
  reason: z.string().min(1)
});

export const assetReceivedPayloadSchema = z.object({
  fromSiteId: z.string().uuid(),
  condition: z.enum(["ok", "damaged", "quarantined"]),
  receivedBy: z.string().min(1)
});

export const inspectionRecordedPayloadSchema = z.object({
  inspectionId: z.string().uuid(),
  status: z.enum(["pass", "fail", "review"]),
  notes: z.string().min(1)
});

export const evidenceAttachedPayloadSchema = z.object({
  inspectionId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  mimeType: z.string().min(3),
  sha256: z.string().min(16)
});

export const transferInitiatedPayloadSchema = z.object({
  transferOrderId: z.string().uuid(),
  originSiteId: z.string().uuid(),
  destinationSiteId: z.string().uuid(),
  initiatedBy: z.string().min(1)
});

export const transferCompletedPayloadSchema = z.object({
  transferOrderId: z.string().uuid(),
  completedBy: z.string().min(1),
  completionNote: z.string().min(1).optional()
});

export const syncStartedPayloadSchema = z.object({
  syncBatchId: z.string().uuid(),
  queuedEventCount: z.number().int().nonnegative()
});

export const syncCompletedPayloadSchema = z.object({
  syncBatchId: z.string().uuid(),
  acceptedEventCount: z.number().int().nonnegative(),
  rejectedEventCount: z.number().int().nonnegative()
});

export const divergenceDetectedPayloadSchema = z.object({
  ruleCode: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string().min(3)
});

export const reconciliationOpenedPayloadSchema = z.object({
  caseId: z.string().uuid(),
  alertId: z.string().uuid(),
  openedBy: z.string().min(1)
});

export const reconciliationResolvedPayloadSchema = z.object({
  caseId: z.string().uuid(),
  resolvedBy: z.string().min(1),
  resolutionSummary: z.string().min(1)
});

export const eventPayloadSchemas: Record<EventType, z.ZodSchema> = {
  asset_registered: assetRegisteredPayloadSchema,
  asset_moved: assetMovedPayloadSchema,
  asset_received: assetReceivedPayloadSchema,
  inspection_recorded: inspectionRecordedPayloadSchema,
  evidence_attached: evidenceAttachedPayloadSchema,
  transfer_initiated: transferInitiatedPayloadSchema,
  transfer_completed: transferCompletedPayloadSchema,
  site_sync_started: syncStartedPayloadSchema,
  site_sync_completed: syncCompletedPayloadSchema,
  divergence_detected: divergenceDetectedPayloadSchema,
  reconciliation_opened: reconciliationOpenedPayloadSchema,
  reconciliation_resolved: reconciliationResolvedPayloadSchema
};

export const createEventRequestSchema = baseEventSchema.superRefine((value, ctx) => {
  const payloadSchema = eventPayloadSchemas[value.eventType];
  const parsed = payloadSchema.safeParse(value.payload);
  if (!parsed.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `payload does not match schema for event type ${value.eventType}`
    });
  }
});

export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;