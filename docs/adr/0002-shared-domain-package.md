# ADR 0002 — Share the domain model between API and web

**Status:** accepted · **Date:** 2026-10-19

## Context

Many rules must give identical answers on both sides: what counts as overdue, how tasks are
grouped (Overdue first, Today, Upcoming…), how a quick-add string is parsed, how a burndown or a
workload cell is computed, which role may do what. Duplicating them invites drift; asking the
server for every derived value makes the UI slow and breaks optimistic updates.

## Decision

`@hearth/domain` is a dependency-free TypeScript package consumed by both apps. It contains
entities, value objects, specifications, strategies and pure domain services. ESLint forbids it
from importing frameworks. The API additionally uses its aggregates and repository ports; the
web uses its pure rules for instant, optimistic UI.

## Consequences

- A rule changes in one place and both apps pick it up at build time.
- The package must stay pure (no I/O, injected `Clock`), which also makes it trivially testable.
- The web bundle includes some server-only code (aggregates); it is small and tree-shakeable.
