import type { CreateEventRequest } from "@ops/contracts";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

const SITE_IDS = {
  north: "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
  central: "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
  coastal: "1b2e7c43-8c9a-4ca4-aef3-27b9a9b28e71"
} as const;

const ASSET_IDS = {
  assetD: "27585a6c-10ad-4cb9-a2fd-b194ab613193",
  assetE: "37adf48f-f6dd-44fb-8f93-9f34af297d6d"
} as const;

async function post(path: string, payload: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`POST ${path} failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function run(): Promise<void> {
  const now = Date.now();

  const deterministicEvents: CreateEventRequest[] = [
    {
      eventType: "asset_registered",
      assetId: ASSET_IDS.assetD,
      siteId: SITE_IDS.north,
      transferOrderId: null,
      occurredAt: new Date(now - 1000 * 60 * 30).toISOString(),
      sourceSiteEventId: "sim-asset-d-registered",
      payload: {
        serialNumber: "SN-OPS-2001",
        containerId: "CNT-D2",
        registeredBy: "sim-operator"
      }
    },
    {
      eventType: "transfer_initiated",
      assetId: ASSET_IDS.assetD,
      siteId: SITE_IDS.north,
      transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
      occurredAt: new Date(now - 1000 * 60 * 25).toISOString(),
      sourceSiteEventId: "sim-transfer-d-init",
      payload: {
        transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
        originSiteId: SITE_IDS.north,
        destinationSiteId: SITE_IDS.coastal,
        initiatedBy: "north-shift-a"
      }
    },
    {
      eventType: "asset_moved",
      assetId: ASSET_IDS.assetD,
      siteId: SITE_IDS.north,
      transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
      occurredAt: new Date(now - 1000 * 60 * 24).toISOString(),
      sourceSiteEventId: "sim-transfer-d-moved",
      payload: {
        fromSiteId: SITE_IDS.north,
        toSiteId: SITE_IDS.coastal,
        reason: "scheduled movement"
      }
    },
    {
      eventType: "asset_registered",
      assetId: ASSET_IDS.assetE,
      siteId: SITE_IDS.central,
      transferOrderId: null,
      occurredAt: new Date(now - 1000 * 60 * 20).toISOString(),
      sourceSiteEventId: "sim-asset-e-registered",
      payload: {
        serialNumber: "SN-OPS-2002",
        containerId: "CNT-E2",
        registeredBy: "sim-operator"
      }
    }
  ];

  // eslint-disable-next-line no-console
  console.log("Submitting online site events...");
  for (const event of deterministicEvents) {
    await post("/events", event);
  }

  // Simulate coastal site offline queue.
  const offlineQueue: CreateEventRequest[] = [
    {
      eventType: "asset_received",
      assetId: ASSET_IDS.assetD,
      siteId: SITE_IDS.coastal,
      transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
      occurredAt: new Date(now - 1000 * 60 * 10).toISOString(),
      sourceSiteEventId: "sim-offline-received-d",
      payload: {
        fromSiteId: SITE_IDS.north,
        condition: "ok",
        receivedBy: "coastal-shift-c"
      }
    },
    {
      eventType: "inspection_recorded",
      assetId: ASSET_IDS.assetD,
      siteId: SITE_IDS.coastal,
      transferOrderId: null,
      occurredAt: new Date(now - 1000 * 60 * 9).toISOString(),
      sourceSiteEventId: "sim-offline-inspection-d",
      payload: {
        inspectionId: "de55347f-a98b-44a0-9988-eb0d3e4f1985",
        status: "review",
        notes: "Physical marking mismatch noted; follow-up evidence required"
      }
    }
  ];

  // eslint-disable-next-line no-console
  console.log("Replaying offline queue via sync batch...");
  await post("/sync/replay", {
    siteId: SITE_IDS.coastal,
    syncBatchId: "af8a07a4-a71b-4a55-9c0f-5060cf149318",
    events: offlineQueue
  });

  // eslint-disable-next-line no-console
  console.log("Running divergence scan...");
  const divergence = await post("/divergence/scan", {});

  // eslint-disable-next-line no-console
  console.log("Simulation completed", divergence);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
