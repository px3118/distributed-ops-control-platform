# ADR-003: Deterministic Sync Simulator Instead of Distributed Runtime

## Status
Accepted

## Context
The project should demonstrate distributed operational behavior without introducing unnecessary infrastructure complexity.

## Decision
Implement a deterministic simulator that emulates offline queueing and replay through the API.

## Consequences
- Pros: reproducible scenarios, easy local execution, clear educational value
- Cons: does not model network partitions at infrastructure level