# Hearth

Keyboard-first work management for teams of 5–500: projects, tasks, boards, timelines, sprints,
workload, inbox, dashboards and admin — built from the **Hearth design system** and its 16 screen
designs (light and dark), as a TypeScript monorepo that applies SOLID, hexagonal architecture,
CQRS and a catalog of design patterns throughout.

```
apps/api        NestJS 11 · @nestjs/cqrs · Prisma 6 · PostgreSQL 16 · socket.io
apps/web        React 19 · Vite 7 · React Router 7 · TanStack Query 5 · Zustand · dnd-kit
packages/domain     framework-free domain model shared by API and web
packages/contracts  zod request schemas + DTO types — the single source of truth for the HTTP API
packages/ui         the Hearth design system as typed React components (tokens, 61 icons, primitives)
docs/               architecture guide, ADRs, design reference (screens + design system)
```

## Quick start

Requirements: Node 20.11+, pnpm 10, PostgreSQL 16 (or Docker).

```bash
pnpm install
pnpm db:up                                  # Postgres in Docker (or use your own)
cp .env.example apps/api/.env              # adjust DATABASE_URL / JWT_SECRET
pnpm --filter @hearth/domain --filter @hearth/contracts build
pnpm --filter @hearth/api prisma:deploy    # apply migrations
pnpm db:seed                                # the demo world from the designs
pnpm dev                                    # API on :3000, web on :5173
```

Open http://localhost:5173 and sign in.

### Demo accounts (password `hearth123`)

| Person                                   | Email                               | Role                          |
| ---------------------------------------- | ----------------------------------- | ----------------------------- |
| Fawad Iqbal                              | fawad@acme.com                      | Owner                         |
| Sara Ahmed                               | sara@acme.com                       | Admin                         |
| Mo Khan, Jia Li, Ravi Teja, Nadia Bashir | mo@ / jia@ / ravi@ / nadia@acme.com | Member                        |
| Tom Walsh                                | tom@northwind.co                    | Guest (Website relaunch only) |
| Priya Oberoi                             | priya@acme.com                      | Deactivated                   |

The seed recreates the designs relative to **today**: the "Acme Studio" workspace, three projects
(Website relaunch, Q4 brand campaign, Mobile app v2), ~100 tasks, the timeline with its
dependencies and milestones, an active sprint with a burndown, an overloaded week on the workload
grid, an approval waiting in the inbox and six weeks of history for the dashboard. It is
deterministic — reseed any time with `pnpm db:seed`.

The workspace is on the **Pro** plan, as in the Billing design. Sprints and dashboard layout/scheduling
are **Business** features: their screens are fully viewable, and writes show the contextual upgrade
prompt. Upgrade on _Settings → Billing_ (simulated, no payment provider) to unlock them.

Set `ANTHROPIC_API_KEY` in `apps/api/.env` to use Claude for AI summaries and task breakdowns;
without it a deterministic local summarizer is used. AI output is always a suggestion a person
accepts, edits or discards.

## What's in the app

| Screen              | Highlights                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **My tasks**        | Grouped by due date (Overdue first), group/sort/filter, saved view, inline quick add (`@person #project !priority tomorrow`), J/K/X/Space/S/A/P keyboard triage, optimistic complete with Undo      |
| **Task panel**      | Side panel over any page (`?task=HRT-188`) or full page; inline editing with autosave, blockers, subtasks with progress, comments with @mentions, activity, live presence, AI summary and breakdown |
| **Project board**   | Drag and drop with WIP limits (warns, never blocks), keyboard "Move to…" (M, Alt+←/→), Undo                                                                                                         |
| **List / Overview** | Status-grouped list; project health with suggested health and reason, milestones, members                                                                                                           |
| **Timeline**        | Gantt with sections, critical path (CPM), baselines, milestones, dependency connectors, conflict badges; drag/resize bars, dependents shift automatically, one-click Undo                           |
| **Calendar**        | Month/week/day, "+N more", unscheduled tray to drag onto days                                                                                                                                       |
| **Workload**        | Hours/tasks/points vs capacity per person per day, time off, over-capacity warnings, rebalance suggestions, drag to reassign                                                                        |
| **Sprints**         | Burndown (ideal vs actual, scope changes), velocity and capacity warnings, ranked backlog, start/complete with retrospective                                                                        |
| **Inbox**           | Mentions / Assigned / Approvals, approve or request changes inline, E/H/U/X triage, snooze, archive with Undo                                                                                       |
| **⌘K palette**      | Commands, tasks, projects, people; local fuzzy match in ~1 ms plus server search; "Ask Hearth AI" turns "overdue design" into a filter                                                              |
| **Dashboard**       | KPI tiles, created vs completed, open work by status, project health table, drag-to-arrange layout                                                                                                  |
| **Members & roles** | Invites with seat limits, role picker with plain-words descriptions, permission matrix, deactivate/reactivate, guests                                                                               |
| **Billing**         | Usage meters with pacing ("on pace to hit the limit Oct 21"), monthly/annual savings, plan cards, downgrade/pause/cancel always reachable                                                           |
| **Home**            | First-run checklist with one highlighted next step, templates                                                                                                                                       |
| **Mobile**          | Bottom tab bar, swipe to complete/snooze, full-screen task, one-at-a-time inbox triage                                                                                                              |

Everything is keyboard-reachable (press `?` for the shortcut sheet, `⌘K`/`Ctrl K` for the palette)
and meets WCAG 2.2 AA intentions: real buttons and labels, focus rings, focus trapping, live
regions, and status/priority/health never conveyed by color alone. Light and dark themes share
the same tokens.

## Architecture

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the ADRs in [`docs/adr`](docs/adr). In short:

- **Modular monolith, hexagonal per bounded context.** 14 contexts in `apps/api/src/modules`
  (identity, workspace, tasks, projects, timeline, workload, sprints, inbox, search, ai, reporting,
  members, billing, onboarding), each with `application/` (commands, queries, event handlers),
  `infrastructure/` (Prisma adapters implementing domain ports, read models) and `presentation/`
  (thin controllers).
- **Shared, pure domain.** `@hearth/domain` holds aggregates (Task, Project, Sprint, Approval,
  WorkspaceMember), value objects, specifications, strategies and domain services (critical path,
  burndown, workload, plan limits, notification policy, KPIs). It imports nothing, so the same rule
  runs on the server and in the browser for instant optimistic UI.
- **CQRS + domain events.** Commands load aggregates through repository ports, enforce invariants,
  save and publish events; queries use read models. Events fan out to the activity log, inbox
  notifications, sprint snapshots, onboarding progress and the websocket.
- **Contracts first.** Every request is validated with the same zod schema the web app's types come from.

Patterns you'll find (with the reason for each in the architecture guide): Aggregate/Entity/Value
object, Repository (port + adapters), CQRS, Observer (domain events), State (task status),
Specification (filters), Strategy (grouping, sorting, AI providers, plans), Factory, Interpreter
(quick add), Chain of responsibility (access rules), Command (⌘K actions + Undo), Adapter, Facade,
Builder, Decorator, Mediator, Template method (event subscribers, optimistic mutations).

## Scripts

| Command                                              | What it does                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                           | API (watch) + web (Vite) + package watchers                                         |
| `pnpm build`                                         | Build everything (Turborepo)                                                        |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Static checks                                                                       |
| `pnpm test`                                          | Unit and component tests (domain, UI, API handlers, web)                            |
| `pnpm test:e2e`                                      | API end-to-end tests against PostgreSQL (`E2E_DATABASE_URL`, default `hearth_test`) |
| `pnpm db:seed`                                       | Reset data to the demo world                                                        |

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, unit tests, e2e tests against a
Postgres service, and builds.

## Deployment

Production runs as a self-contained Docker Compose stack behind a shared Caddy edge proxy: see [docs/DEPLOY.md](docs/DEPLOY.md). Update with `deploy/deploy.sh` on the server.
