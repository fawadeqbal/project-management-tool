# ADR 0003 — CQRS with domain events

**Status:** accepted · **Date:** 2026-10-19

## Context

Write operations must protect invariants (no dependency cycles, one active sprint, valid
schedules, permission checks). Reads are numerous, view-shaped and performance-sensitive
(boards, timelines, dashboards). Several contexts must react to the same change.

## Decision

- **Commands** go through handlers that load aggregates via repository ports, call behavior
  methods, save, and publish the recorded domain events.
- **Queries** go through read models that query Prisma directly and return contract DTOs.
- **Domain events** (`task.status_changed`, `comment.created`, `approval.requested`,
  `sprint.completed`…) fan out to event handlers: activity log, inbox notifications, sprint
  snapshots, websocket broadcast.

## Consequences

- Handlers are small, single-purpose and unit-testable with in-memory repositories.
- Read models can be optimized (or later moved to a replica/projection) without touching rules.
- Event handlers run after the write commits; they must be idempotent and tolerate failure
  (an outbox can be added if delivery guarantees are needed).
