# AGENTS

## Purpose

This repository is a clean-room, public-safe operations platform reference implementation.

## Engineering Rules

- Keep event types and field names stable.
- Preserve append-only semantics in `event_log`.
- Projection logic must remain deterministic and replay-safe.
- Divergence rules must be generic and documented.
- Do not add domain language tied to proprietary or protected industries.
- Any new workflow must include tests and documentation updates.

## Change Workflow

1. Update schema/migrations first for data model changes.
2. Update contracts and event schemas.
3. Update domain logic and handlers.
4. Update API routes.
5. Update simulator path if event flow changes.
6. Update UI and docs.
7. Add/adjust unit and integration tests.

## Logging and Traceability

- Use structured logs.
- Keep event IDs and sync batch IDs visible in logs where relevant.
- Include deterministic IDs in simulation scripts for reproducibility.

## Safety Boundaries

- Never introduce proprietary terminology or copied workflows.
- Never include real data, screenshots, or customer artifacts.
- Keep all divergence thresholds explicit and generic.