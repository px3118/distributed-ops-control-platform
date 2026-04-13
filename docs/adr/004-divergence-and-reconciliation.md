# ADR-004: Rule-Based Divergence Engine with Reconciliation Escalation

## Status
Accepted

## Context
Operational exceptions must be visible and actionable without proprietary business logic.

## Decision
Implement generic rule-based divergence detection with alert creation and automatic reconciliation case creation for high-severity findings.

## Consequences
- Pros: transparent rules, auditable alerts, practical exception handling workflow
- Cons: rules require tuning as domain complexity grows