# Architecture

## System Context

The platform provides centralized operational control for serialized assets across multiple sites. Sites can operate independently for short periods, queue events when offline, and later replay events through sync batches.

## High-Level Components

- API (`apps/api`): event ingestion, projection updates, divergence scan, reconciliation workflows
- Database (PostgreSQL): source of truth and projections
- Workbench UI (`apps/web`): operator dashboard and investigation surfaces
- Simulator (`apps/simulator`): deterministic offline/online scenario runner

## Runtime Topology

```mermaid
flowchart LR
  SiteA[Site A] -->|Events| API
  SiteB[Site B] -->|Events| API
  SiteC[Site C Offline Queue] -->|Sync Replay Batch| API
  API --> EventLog[(event_log)]
  API --> Projection[(asset_projection)]
  API --> OpsTables[(transfer/inspection/alert/case)]
  UI -->|Read APIs| API
  Simulator -->|Replay + Scan| API
```

## Event Ingestion and Projection Flow

```mermaid
flowchart LR
  Inbound[Inbound Event] --> Validate[Validate Envelope + Payload]
  Validate --> Dedupe{Duplicate source event?}
  Dedupe -->|Yes| ReturnDedup[Return deduplicated acceptance]
  Dedupe -->|No| Append[Append event_log]
  Append --> SideEffects[Apply side effects]
  SideEffects --> Reduce[Projection reducer]
  Reduce --> Projection[(asset_projection)]
```

## Sync Replay Flow

```mermaid
sequenceDiagram
  participant Site
  participant API
  participant DB
  Site->>API: POST /api/v1/sync/replay
  API->>DB: append site_sync_started
  loop queued events
    API->>DB: dedupe by (site_id, source_site_event_id)
    API->>DB: append accepted event_log rows
    API->>DB: side effects + projection updates
  end
  API->>DB: append site_sync_completed
  API-->>Site: accepted/rejected/deduplicated counts
```

## Reconciliation Lifecycle

```mermaid
stateDiagram-v2
  [*] --> AlertOpen: divergence_detected
  AlertOpen --> CaseOpen: auto-open(high) or manual-open
  CaseOpen --> Investigating: operator analysis
  Investigating --> Resolved: resolve action submitted
  Resolved --> EventWritten: reconciliation_resolved appended
  EventWritten --> [*]
```

## Internal API Architecture

- Route layer: versioned endpoints and request validation
- Domain services: event ingestion, replay, divergence scanning, query aggregation
- DB layer: Drizzle schema + SQL migration management

## Key Flows

1. Event Ingestion:
- validate request against event-specific schema
- deduplicate by `(site_id, source_site_event_id)`
- append to `event_log`
- apply side effects (transfer, inspection, evidence, sync)
- update `asset_projection`

2. Sync Replay:
- emit `site_sync_started`
- replay queued events idempotently
- emit `site_sync_completed`
- update site sync timestamp and batch counts

3. Divergence Scan:
- evaluate generic divergence rules against operational tables
- create alerts for new findings
- auto-open reconciliation cases for high severity findings

## Operational Qualities

- append-only ledger for auditability
- deterministic projection updates
- idempotent replay using source event dedupe keys
- explicit rule-based divergence detection
- reconciliation workflow visibility

## Non-Goals

- Not a production authorization or tenancy model.
- Not a full distributed infrastructure deployment topology.
- Not a clone of any protected internal architecture.
