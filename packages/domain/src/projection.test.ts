import { describe, expect, it } from "vitest";
import { applyEventToProjection, replayProjection, type DomainEvent } from "./projection";

function makeEvent(overrides: Partial<DomainEvent>): DomainEvent {
  return {
    eventId: overrides.eventId ?? crypto.randomUUID(),
    eventType: overrides.eventType ?? "asset_registered",
    sequenceNumber: overrides.sequenceNumber ?? 1,
    assetId: overrides.assetId ?? "7b4b2d2f-88fb-4d8d-931a-6a5645f1e7c2",
    siteId: overrides.siteId ?? "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
    transferOrderId: overrides.transferOrderId ?? null,
    occurredAt: overrides.occurredAt ?? new Date().toISOString(),
    payload: overrides.payload ?? { serialNumber: "SN-1", registeredBy: "tester" }
  };
}

describe("projection reducer", () => {
  it("applies lifecycle events deterministically", () => {
    const registered = makeEvent({ eventType: "asset_registered", sequenceNumber: 1 });
    const moved = makeEvent({
      eventType: "asset_moved",
      sequenceNumber: 2,
      payload: {
        fromSiteId: "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
        toSiteId: "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
        reason: "scheduled"
      }
    });
    const received = makeEvent({
      eventType: "asset_received",
      sequenceNumber: 3,
      siteId: "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
      payload: {
        fromSiteId: "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
        condition: "ok",
        receivedBy: "receiver"
      }
    });

    const projection = replayProjection(null, [received, moved, registered]);

    expect(projection?.status).toBe("at_site");
    expect(projection?.currentSiteId).toBe("c55f6935-40df-4aa7-9f84-5b9c8e5f9a60");
    expect(projection?.lastSequence).toBe(3);
  });

  it("is idempotent when replayed from same event stream", () => {
    const events = [
      makeEvent({ eventType: "asset_registered", sequenceNumber: 1 }),
      makeEvent({
        eventType: "transfer_initiated",
        sequenceNumber: 2,
        payload: {
          transferOrderId: "6d55f8f7-5ddf-4c07-91f7-26d1b91a9f20",
          originSiteId: "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
          destinationSiteId: "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
          initiatedBy: "ops"
        }
      })
    ];

    const firstReplay = replayProjection(null, events);
    const secondReplay = replayProjection(null, events);

    expect(secondReplay).toEqual(firstReplay);
  });

  it("ignores system-level events without asset id", () => {
    const systemEvent = makeEvent({
      eventType: "site_sync_started",
      assetId: null,
      payload: {
        syncBatchId: "cb16f437-d84e-4f7e-a3b8-66c4f7376d1d",
        queuedEventCount: 3
      }
    });

    const projection = applyEventToProjection(null, systemEvent);
    expect(projection).toBeNull();
  });
});
