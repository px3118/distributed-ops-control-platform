# Non-Goals and Safety Boundaries

## Non-Goals

- Reproducing any proprietary platform behavior
- Replicating confidential schemas or terminology
- Including customer-specific workflows
- Solving every distributed systems failure mode
- Building a production-hardened auth or tenancy layer

## Safety Boundaries

- Generic domain terms only: sites, assets, transfers, inspections, evidence metadata, sync batches, alerts, reconciliation cases
- No protected industry-specific logic or naming
- No real business thresholds from prior systems
- No real customer records, media, or screenshots
- No copied internal documentation text

## Public-Safe Design Choices

- Explicitly generic divergence rules
- Deterministic simulator with synthetic IDs
- Synthetic evidence references (`evidence://...`) only
- Generic status vocab and generic operational metrics
