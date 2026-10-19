# ADR 0001 — A modular monolith, not microservices

**Status:** accepted · **Date:** 2026-10-19

## Context

Hearth serves teams of 5–500. Its contexts (tasks, planning, sprints, inbox, billing…) are
tightly related: a task status change updates a board, a burndown, a workload cell, a dashboard
and an inbox at once. The team is small and wants to ship quickly without giving up boundaries.

## Decision

One deployable NestJS API, split into bounded-context modules with hexagonal layers inside each.
Contexts communicate through **domain events** on an in-process event bus, never by reaching
into another context's repositories. The domain model lives in a framework-free package.

## Consequences

* One database, transactions where needed, simple local development and deployment.
* Boundaries are explicit (module per context, events between them), so a context can be
  extracted into a service later by replacing the in-process bus with a broker — handlers and
  the domain stay unchanged.
* Discipline is required: reviews check that a context only imports `@hearth/domain`,
  `@hearth/contracts` and `src/shared`.
