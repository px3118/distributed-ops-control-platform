# ADR-001: Append-Only Event Ledger with Projection Read Model

## Status
Accepted

## Context
The platform must support auditability, replay, and offline sync ingestion.

## Decision
Use an append-only `event_log` as source of truth and maintain `asset_projection` as deterministic current-state materialization.

## Consequences
- Pros: replayable history, strong audit trail, easier divergence analysis
- Cons: requires projection maintenance and sequence integrity checks