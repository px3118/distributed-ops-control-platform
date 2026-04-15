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

type ScenarioName = "healthy-movement" | "sync-lag-divergence";

type ScenarioDefinition = {
  name: ScenarioName;
  description: string;
  onlineEvents: CreateEventRequest[];
  offlineReplayBatchId?: string;
  offlineEvents?: CreateEventRequest[];
};

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

function resolveScenarioName(): ScenarioName {
  const argValue = process.argv.find((value) => value.startsWith("--scenario="));
  const fromArg = argValue?.split("=")[1];
  const fromEnv = process.env.SIM_SCENARIO;
  const raw = (fromArg ?? fromEnv ?? "sync-lag-divergence").trim();

  if (raw === "healthy-movement" || raw === "sync-lag-divergence") {
    return raw;
  }
  return "sync-lag-divergence";
}

function buildScenarios(now: number): Record<ScenarioName, ScenarioDefinition> {
  const iso = (minutesAgo: number): string =>
    new Date(now - 1000 * 60 * minutesAgo).toISOString();

  return {
    "healthy-movement": {
      name: "healthy-movement",
      description: "End-to-end transfer completion with inspection evidence and no replay errors.",
      onlineEvents: [
        {
          eventType: "asset_registered",
          assetId: ASSET_IDS.assetD,
          siteId: SITE_IDS.north,
          transferOrderId: null,
          occurredAt: iso(30),
          sourceSiteEventId: "sim-healthy-asset-d-registered",
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
          occurredAt: iso(25),
          sourceSiteEventId: "sim-healthy-transfer-init",
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
          occurredAt: iso(24),
          sourceSiteEventId: "sim-healthy-transfer-moved",
          payload: {
            fromSiteId: SITE_IDS.north,
            toSiteId: SITE_IDS.coastal,
            reason: "Scheduled movement"
          }
        },
        {
          eventType: "asset_received",
          assetId: ASSET_IDS.assetD,
          siteId: SITE_IDS.coastal,
          transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
          occurredAt: iso(20),
          sourceSiteEventId: "sim-healthy-transfer-received",
          payload: {
            fromSiteId: SITE_IDS.north,
            condition: "ok",
            receivedBy: "coastal-shift-c"
          }
        },
        {
          eventType: "transfer_completed",
          assetId: ASSET_IDS.assetD,
          siteId: SITE_IDS.coastal,
          transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
          occurredAt: iso(18),
          sourceSiteEventId: "sim-healthy-transfer-complete",
          payload: {
            transferOrderId: "5d85d84f-3875-4774-a3f8-7bc5b3944c66",
            completedBy: "coastal-shift-c",
            completionNote: "Arrival confirmed"
          }
        }
      ]
    },
    "sync-lag-divergence": {
      name: "sync-lag-divergence",
      description:
        "Mixed online/offline flow with replay submission and divergence scan for operational drift.",
      onlineEvents: [
        {
          eventType: "asset_registered",
          assetId: ASSET_IDS.assetE,
          siteId: SITE_IDS.central,
          transferOrderId: null,
          occurredAt: iso(30),
          sourceSiteEventId: "sim-drift-asset-e-registered",
          payload: {
            serialNumber: "SN-OPS-2002",
            containerId: "CNT-E2",
            registeredBy: "sim-operator"
          }
        },
        {
          eventType: "inspection_recorded",
          assetId: ASSET_IDS.assetE,
          siteId: SITE_IDS.central,
          transferOrderId: null,
          occurredAt: iso(24),
          sourceSiteEventId: "sim-drift-inspection-e",
          payload: {
            inspectionId: "de55347f-a98b-44a0-9988-eb0d3e4f1985",
            status: "review",
            notes: "Evidence pending while site queue is delayed."
          }
        }
      ],
      offlineReplayBatchId: "af8a07a4-a71b-4a55-9c0f-5060cf149318",
      offlineEvents: [
        {
          eventType: "asset_received",
          assetId: ASSET_IDS.assetE,
          siteId: SITE_IDS.coastal,
          transferOrderId: null,
          occurredAt: iso(10),
          sourceSiteEventId: "sim-drift-offline-received-e",
          payload: {
            fromSiteId: SITE_IDS.central,
            condition: "ok",
            receivedBy: "coastal-shift-c"
          }
        },
        {
          eventType: "inspection_recorded",
          assetId: ASSET_IDS.assetE,
          siteId: SITE_IDS.coastal,
          transferOrderId: null,
          occurredAt: iso(9),
          sourceSiteEventId: "sim-drift-offline-inspection-e",
          payload: {
            inspectionId: "314c5a28-fac0-4c54-bd91-0cd22f5668a2",
            status: "review",
            notes: "Offline inspection replayed."
          }
        }
      ]
    }
  };
}

async function run(): Promise<void> {
  const now = Date.now();
  const scenarioName = resolveScenarioName();
  const scenarios = buildScenarios(now);
  const scenario = scenarios[scenarioName];

  // eslint-disable-next-line no-console
  console.log(`Running simulator scenario: ${scenario.name}`);
  // eslint-disable-next-line no-console
  console.log(scenario.description);

  for (const event of scenario.onlineEvents) {
    await post("/events", event);
  }

  if (scenario.offlineReplayBatchId && scenario.offlineEvents && scenario.offlineEvents.length > 0) {
    await post("/sync/replay", {
      siteId: SITE_IDS.coastal,
      syncBatchId: scenario.offlineReplayBatchId,
      events: scenario.offlineEvents
    });
  }

  const divergence = await post("/divergence/scan", {});
  // eslint-disable-next-line no-console
  console.log("Simulation completed", divergence);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
