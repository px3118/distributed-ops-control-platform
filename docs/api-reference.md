# API Reference

## Base URL

- Local: `http://localhost:4000`
- Versioned API: `http://localhost:4000/api/v1`

## Health and Metrics

- `GET /health`: service heartbeat and uptime
- `GET /api/v1/health`: versioned heartbeat endpoint
- `GET /metrics`: in-memory operational counters

## Core Read Endpoints

- `GET /api/v1/dashboard`
- `GET /api/v1/sites`
- `GET /api/v1/sites/:siteId`
- `GET /api/v1/assets`
- `GET /api/v1/assets/:assetId`
- `GET /api/v1/assets/:assetId/events`
- `GET /api/v1/transfers`
- `GET /api/v1/transfers/:transferId`
- `GET /api/v1/sync-batches`
- `GET /api/v1/sync-batches/:syncBatchId`
- `GET /api/v1/alerts`
- `GET /api/v1/reconciliation-cases`
- `GET /api/v1/reconciliation-cases/:caseId`

## Core Write Endpoints

- `POST /api/v1/events`
- `POST /api/v1/sync/replay`
- `POST /api/v1/divergence/scan`
- `POST /api/v1/reconciliation-cases`
- `PATCH /api/v1/reconciliation-cases/:caseId/resolve`

## Request/Response Notes

- Requests are validated with Zod contracts (`packages/contracts`).
- Event payload schema depends on `eventType`.
- API errors use structured payload:

```json
{
  "error": {
    "message": "Readable failure message",
    "details": {}
  }
}
```

## Example: Ingest Event

`POST /api/v1/events`

```json
{
  "eventType": "transfer_initiated",
  "assetId": "7b4b2d2f-88fb-4d8d-931a-6a5645f1e7c2",
  "siteId": "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
  "transferOrderId": "6d55f8f7-5ddf-4c07-91f7-26d1b91a9f20",
  "occurredAt": "2026-04-13T19:35:08.204Z",
  "sourceSiteEventId": "north-transfer-init-001",
  "payload": {
    "transferOrderId": "6d55f8f7-5ddf-4c07-91f7-26d1b91a9f20",
    "originSiteId": "9f1a3d29-8db1-4d2e-9c7f-4c6e46d5b2a1",
    "destinationSiteId": "c55f6935-40df-4aa7-9f84-5b9c8e5f9a60",
    "initiatedBy": "north-operator"
  }
}
```

Response:

```json
{
  "data": {
    "eventId": "dc1e5f53-22ec-4593-9e7f-77e83ccf4f74",
    "sequenceNumber": 42,
    "deduplicated": false
  }
}
```

## Flow Summary

1. API validates event envelope + type-specific payload.
2. Event is deduplicated by `(site_id, source_site_event_id)` when provided.
3. Event is appended to `event_log`.
4. Deterministic side effects update transfer/inspection/evidence/sync tables.
5. Projection reducer updates `asset_projection`.

## Non-Goals

- Not a full public API product surface.
- Not version-negotiated backward compatibility guarantees.
- Not an implementation of confidential endpoint contracts.
