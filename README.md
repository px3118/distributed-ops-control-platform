# Distributed Ops Control Platform

A distributed operations control system that models how real-world systems drift out of sync and how that drift is detected and reconciled.

This project demonstrates event-driven state, projection consistency, and operator workflows for resolving inconsistencies across distributed sites.

Clean-room reference implementation of an internal operations platform for tracking serialized assets across distributed sites.  
The system is designed to show event integrity, sync drift, and reconciliation controls under realistic operational conditions.

## Clean-Room Statement

This repository is original and public-safe. It intentionally avoids proprietary schemas, internal terminology, customer data, and protected workflows.

## What This System Demonstrates

- Append-only event ledger (`event_log`) as the system record
- Deterministic current-state projection (`asset_projection`)
- Idempotent event ingestion and sync replay
- Divergence detection for transfer, evidence, staleness, and projection integrity
- Reconciliation workflow with auditable open/resolve actions
- Operator-focused UI for investigation and state visibility

## Concrete Scenario Walkthrough

Three sites (`NORTH`, `CENTRAL`, `COASTAL`) manage the same asset fleet.

1. Asset A transfer from `NORTH` to `CENTRAL` is initiated, moved, received, and confirmed.
2. Asset B transfer from `CENTRAL` to `COASTAL` is initiated but never confirmed.
3. Asset B is later observed at two sites, creating a conflicting observation condition.
4. Asset C inspection is recorded without evidence metadata.
5. `COASTAL` replays an offline queue through a sync batch.
6. `CENTRAL` remains stale past sync policy threshold.
7. Divergence scan opens alerts and auto-opens high-severity reconciliation cases.

The UI exposes this state through dashboard, assets, transfer timeline, reconciliation workbench, and sync batch views.

## Why Reconciliation Exists

Distributed operations drift even with strong process controls:

- Sites can disconnect and replay later.
- Transfer and receipt timing can diverge across teams.
- Evidence can be missing at initial inspection time.
- Projections can lag accepted events during transient failures.

Reconciliation is the control loop that turns drift into explicit, owned, auditable work.

## Why `event_log` Does Not Foreign-Key Every Reference

`event_log` is the append-only source of truth. Some identifiers in an event refer to records that are created only after the event is accepted:

- `asset_registered` creates `asset`
- `transfer_initiated` creates `transfer_order`
- `site_sync_started` creates `sync_batch`

If `event_log` enforced foreign keys on those forward-created entities, valid events could not be written in correct order.

For that reason:

- `event_log.site_id` keeps a foreign key (site must already exist)
- `event_log.asset_id`, `event_log.transfer_order_id`, and `event_log.sync_batch_id` are indexed but not foreign-key constrained

This preserves ingestion correctness while keeping query performance and downstream integrity checks.

## Monorepo Layout

- `apps/api` Fastify API with Drizzle/PostgreSQL
- `apps/web` Next.js operations workbench
- `apps/simulator` deterministic sync/offline simulator
- `packages/contracts` shared Zod request/event schemas
- `packages/domain` projection and divergence rule logic
- `packages/config` shared TypeScript config
- `packages/ui` shared UI helpers
- `docs` architecture/domain/event/sync/reconciliation/API docs + ADRs
- `scripts` bootstrap utilities

## Architecture Summary

1. API validates and appends events to `event_log`.
2. Event side effects update transfer, inspection, evidence, and sync tables.
3. Projection reducer updates `asset_projection` deterministically by sequence.
4. Divergence scanner evaluates rule set and writes alerts/cases.
5. Operators review and resolve exceptions in the workbench.

## Event Types

- `asset_registered`
- `asset_moved`
- `asset_received`
- `inspection_recorded`
- `evidence_attached`
- `transfer_initiated`
- `transfer_completed`
- `site_sync_started`
- `site_sync_completed`
- `divergence_detected`
- `reconciliation_opened`
- `reconciliation_resolved`

## Operational Thresholds

Default thresholds are configured through environment variables:

- `SYNC_STALE_MINUTES=45`: site sync is marked stale when no completion is recorded inside this window.
- `TRANSFER_CONFIRMATION_HOURS=4`: initiated transfer is flagged when destination confirmation is overdue.
- Missing evidence: an inspection with zero `evidence_metadata` rows is treated as an evidence gap.

These are intentionally generic defaults for public-safe demonstration and can be tuned per environment.

## Terminology

- **Event stream**: append-only record of accepted operational events (`event_log`).
- **Projection**: deterministic current-state materialization derived from event replay (`asset_projection`).
- **Replay**: ingestion of queued site events after delayed connectivity.
- **Sync batch**: grouped replay submission for a site, including accepted/rejected counts.
- **Divergence**: detected mismatch between expected and observed operational state.
- **Reconciliation case**: explicit operator workflow item opened to investigate and resolve divergence.

## Local Run

Prerequisites:

- Docker + Docker Compose
- Node.js 20+ (for local non-container scripts)

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec api npm run db:migrate
docker compose exec api npm run seed
```

Endpoints:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Dashboard API: `http://localhost:4000/api/v1/dashboard`

## Simulator

```bash
npm run start --workspace apps/simulator
```

The simulator posts deterministic events, replays an offline queue with a sync batch, and triggers divergence scan.

## Testing

```bash
npm test
npm run test:e2e
```

- Unit tests: projection reducer and divergence rules
- Integration tests: API route behavior and validation
- E2E smoke test: main dashboard surface

## Non-Goals

- Production auth and tenancy implementation
- Proprietary workflow replication
- Real evidence/object storage integration
- Full distributed infrastructure orchestration

## Design Priorities

- Clarity over clever abstraction
- Determinism over hidden behavior
- Auditability over mutable shortcuts
- Operational readability over visual flourish
