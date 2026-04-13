import "dotenv/config";
import { db, closeDatabase } from "./client";
import { sites } from "./schema";
import { ingestEvent, ingestSyncReplay } from "../domain/event-service";
import { runDivergenceScan } from "../domain/divergence-service";

const SITE_IDS = {
  north: "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
  central: "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
  coastal: "1b2e7c43-8c9a-4ca4-aef3-27b9a9b28e71"
} as const;

async function seedSites(): Promise<void> {
  await db
    .insert(sites)
    .values([
      { id: SITE_IDS.north, code: "NORTH", name: "North Site" },
      { id: SITE_IDS.central, code: "CENTRAL", name: "Central Site" },
      { id: SITE_IDS.coastal, code: "COASTAL", name: "Coastal Site" }
    ])
    .onConflictDoNothing();
}

async function seedEvents(): Promise<void> {
  const baseTime = Date.now();
  const minutesAgo = (minutes: number): string =>
    new Date(baseTime - 1000 * 60 * minutes).toISOString();

  const assetA = "7b4b2d2f-88fb-4d8d-931a-6a5645f1e7c2";
  const assetB = "5f1c31f1-08d4-4e74-a4d2-213df560bd95";
  const assetC = "20fb2e4a-7423-4f0f-b3ca-31a6cc37cd55";

  await ingestEvent(db, {
    eventType: "asset_registered",
    assetId: assetA,
    siteId: SITE_IDS.north,
    transferOrderId: null,
    occurredAt: minutesAgo(180),
    sourceSiteEventId: "seed-asset-a-registered",
    payload: {
      serialNumber: "SN-OPS-1001",
      containerId: "CNT-A1",
      registeredBy: "bootstrap-loader"
    }
  });

  await ingestEvent(db, {
    eventType: "asset_registered",
    assetId: assetB,
    siteId: SITE_IDS.central,
    transferOrderId: null,
    occurredAt: minutesAgo(170),
    sourceSiteEventId: "seed-asset-b-registered",
    payload: {
      serialNumber: "SN-OPS-1002",
      containerId: "CNT-B4",
      registeredBy: "bootstrap-loader"
    }
  });

  await ingestEvent(db, {
    eventType: "asset_registered",
    assetId: assetC,
    siteId: SITE_IDS.coastal,
    transferOrderId: null,
    occurredAt: minutesAgo(160),
    sourceSiteEventId: "seed-asset-c-registered",
    payload: {
      serialNumber: "SN-OPS-1003",
      containerId: "CNT-C8",
      registeredBy: "bootstrap-loader"
    }
  });

  const transferOneId = "6d55f8f7-5ddf-4c07-91f7-26d1b91a9f20";
  await ingestEvent(db, {
    eventType: "transfer_initiated",
    assetId: assetA,
    siteId: SITE_IDS.north,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(150),
    sourceSiteEventId: "seed-transfer-1-init",
    payload: {
      transferOrderId: transferOneId,
      originSiteId: SITE_IDS.north,
      destinationSiteId: SITE_IDS.central,
      initiatedBy: "north-operator"
    }
  });

  await ingestEvent(db, {
    eventType: "asset_moved",
    assetId: assetA,
    siteId: SITE_IDS.north,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(145),
    sourceSiteEventId: "seed-transfer-1-moved",
    payload: {
      fromSiteId: SITE_IDS.north,
      toSiteId: SITE_IDS.central,
      reason: "Scheduled inventory balancing transfer"
    }
  });

  const transferTwoId = "bf2c91a2-0a0a-4cc2-91ef-713d723445a1";
  await ingestEvent(db, {
    eventType: "transfer_initiated",
    assetId: assetB,
    siteId: SITE_IDS.central,
    transferOrderId: transferTwoId,
    occurredAt: minutesAgo(330),
    sourceSiteEventId: "seed-transfer-2-init",
    payload: {
      transferOrderId: transferTwoId,
      originSiteId: SITE_IDS.central,
      destinationSiteId: SITE_IDS.coastal,
      initiatedBy: "central-operator"
    }
  });

  await ingestEvent(db, {
    eventType: "asset_received",
    assetId: assetA,
    siteId: SITE_IDS.central,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(110),
    sourceSiteEventId: "seed-transfer-1-received",
    payload: {
      fromSiteId: SITE_IDS.north,
      condition: "ok",
      receivedBy: "central-receiver"
    }
  });

  await ingestEvent(db, {
    eventType: "transfer_completed",
    assetId: assetA,
    siteId: SITE_IDS.central,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(105),
    sourceSiteEventId: "seed-transfer-1-complete",
    payload: {
      transferOrderId: transferOneId,
      completedBy: "central-receiver",
      completionNote: "Received and confirmed at destination site"
    }
  });

  const inspectionId = "f0b64f4e-28d8-452f-a815-c2db473c3a4f";
  await ingestEvent(db, {
    eventType: "inspection_recorded",
    assetId: assetC,
    siteId: SITE_IDS.coastal,
    transferOrderId: null,
    occurredAt: minutesAgo(90),
    sourceSiteEventId: "seed-inspection-c",
    payload: {
      inspectionId,
      status: "review",
      notes: "Surface condition differs from last inspection. Evidence required."
    }
  });

  const inspectionWithEvidenceId = "74c53fe2-34f7-4282-a35d-848d3ce67c34";
  const evidenceId = "f87d9a37-208e-4acd-ad07-758f24526440";

  await ingestEvent(db, {
    eventType: "inspection_recorded",
    assetId: assetA,
    siteId: SITE_IDS.central,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(95),
    sourceSiteEventId: "seed-inspection-a",
    payload: {
      inspectionId: inspectionWithEvidenceId,
      status: "pass",
      notes: "Arrival verification completed with evidence attached"
    }
  });

  await ingestEvent(db, {
    eventType: "evidence_attached",
    assetId: assetA,
    siteId: SITE_IDS.central,
    transferOrderId: transferOneId,
    occurredAt: minutesAgo(94),
    sourceSiteEventId: "seed-evidence-a",
    payload: {
      inspectionId: inspectionWithEvidenceId,
      evidenceId,
      mimeType: "image/jpeg",
      sha256: "aacceeff11223344556677889900aabbccddeeff00112233445566778899aabb"
    }
  });

  // Deliberate conflicting observation for divergence detection.
  await ingestEvent(db, {
    eventType: "asset_received",
    assetId: assetB,
    siteId: SITE_IDS.north,
    transferOrderId: transferTwoId,
    occurredAt: minutesAgo(80),
    sourceSiteEventId: "seed-asset-b-observed-north",
    payload: {
      fromSiteId: SITE_IDS.central,
      condition: "ok",
      receivedBy: "north-receiver"
    }
  });

  await ingestEvent(db, {
    eventType: "asset_received",
    assetId: assetB,
    siteId: SITE_IDS.coastal,
    transferOrderId: transferTwoId,
    occurredAt: minutesAgo(75),
    sourceSiteEventId: "seed-asset-b-observed-coastal",
    payload: {
      fromSiteId: SITE_IDS.central,
      condition: "ok",
      receivedBy: "coastal-receiver"
    }
  });

  const offlineInspectionId = "7e227b81-bf17-4f95-b706-a4f3651f8092";
  const offlineEvents = [
    {
      eventType: "asset_moved",
      assetId: assetC,
      siteId: SITE_IDS.coastal,
      transferOrderId: null,
      occurredAt: minutesAgo(50),
      sourceSiteEventId: "coastal-offline-1",
      payload: {
        fromSiteId: SITE_IDS.coastal,
        toSiteId: SITE_IDS.north,
        reason: "Container relocation pending route confirmation"
      }
    },
    {
      eventType: "inspection_recorded",
      assetId: assetC,
      siteId: SITE_IDS.coastal,
      transferOrderId: null,
      occurredAt: minutesAgo(45),
      sourceSiteEventId: "coastal-offline-2",
      payload: {
        inspectionId: offlineInspectionId,
        status: "pass",
        notes: "Post-move verification complete"
      }
    },
    {
      eventType: "evidence_attached",
      assetId: assetC,
      siteId: SITE_IDS.coastal,
      transferOrderId: null,
      occurredAt: minutesAgo(44),
      sourceSiteEventId: "coastal-offline-3",
      payload: {
        inspectionId: offlineInspectionId,
        evidenceId: "fb34a853-b367-4fd2-a4f5-2536fa396255",
        mimeType: "image/jpeg",
        sha256: "bb11cc22dd33ee44ff5566778899aabbccddeeff00112233445566778899ccdd"
      }
    }
  ] as const;

  await ingestSyncReplay(db, {
    siteId: SITE_IDS.coastal,
    syncBatchId: "9f1f9d4a-4505-4906-8f11-b18d20d2f41a",
    events: offlineEvents.map((event) => ({ ...event }))
  });

  const northSyncBatchId = "cb16f437-d84e-4f7e-a3b8-66c4f7376d1d";
  await ingestEvent(db, {
    eventType: "site_sync_started",
    assetId: null,
    siteId: SITE_IDS.north,
    transferOrderId: null,
    occurredAt: minutesAgo(35),
    sourceSiteEventId: "seed-north-sync-started",
    payload: {
      syncBatchId: northSyncBatchId,
      queuedEventCount: 0
    }
  });

  await ingestEvent(db, {
    eventType: "site_sync_completed",
    assetId: null,
    siteId: SITE_IDS.north,
    transferOrderId: null,
    occurredAt: minutesAgo(34),
    sourceSiteEventId: "seed-north-sync-completed",
    payload: {
      syncBatchId: northSyncBatchId,
      acceptedEventCount: 0,
      rejectedEventCount: 0
    }
  });
}

async function main(): Promise<void> {
  await seedSites();
  await seedEvents();
  await runDivergenceScan(db);
  // eslint-disable-next-line no-console
  console.log("Seed complete");
}

main()
  .then(() => closeDatabase())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
