# ADR 0004 — Optimistic UI with Undo instead of confirmations

**Status:** accepted · **Date:** 2026-10-19

## Context

The design system's principles: keyboard-first, forgiving, fast (Doherty threshold — under
100ms). Confirmation dialogs slow experts down and train people to click "OK" blindly.

## Decision

- Reversible mutations (complete, move, reassign, reschedule, archive, snooze) update the cache
  immediately, call the API, and show an 8-second Undo toast. On failure the change rolls back
  and the toast explains what happened and that we'll retry or how to fix it.
- Only irreversible actions (delete a task, remove a member permanently) ask for confirmation.
- Every action is a `Command` object, so the same behavior is reachable from ⌘K, shortcuts and
  menus.

## Consequences

- A shared `useOptimisticMutation` helper owns snapshot → apply → rollback → invalidate.
- The server remains the source of truth; realtime events and invalidation reconcile caches.
