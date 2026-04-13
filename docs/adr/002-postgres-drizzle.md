# ADR-002: PostgreSQL + Drizzle ORM

## Status
Accepted

## Context
The project requires explicit relational schema control and migration visibility.

## Decision
Use PostgreSQL for storage and Drizzle for typed schema/query definitions with SQL migration files committed in-repo.

## Consequences
- Pros: explicit schema, typed queries, clear migration diffs
- Cons: migration and SQL ownership remains manual and intentional