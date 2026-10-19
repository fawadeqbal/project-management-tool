# Hearth architecture

Hearth is a work-management product (projects, tasks, boards, timelines, sprints, workload,
inbox, dashboards) built as a **TypeScript monorepo** with a **modular-monolith API** and a
**feature-sliced React app**. The design source of truth is in `docs/design-reference/`
(the Hearth design system and 16 screen designs, light and dark).

```
hearth/
├─ apps/
│  ├─ api/            NestJS 11 · CQRS · Prisma 6 · PostgreSQL 16 · socket.io
│  └─ web/            React 19 · Vite · React Router 7 · TanStack Query 5 · Zustand · dnd-kit
├─ packages/
│  ├─ domain/         Framework-free domain model (entities, value objects, policies, domain services)
│  ├─ contracts/      zod request schemas + DTO types + route paths, shared by api and web
│  └─ ui/             Hearth design system as typed React components + tokens (light/dark)
└─ docs/              Architecture, ADRs, design reference
```

## The dependency rule

```
          ┌──────────────── apps/web ────────────────┐   ┌──────────── apps/api ────────────┐
          │ features → shared → @hearth/ui           │   │ presentation → application       │
          │        ↘ @hearth/contracts               │   │ application → @hearth/domain     │
          │        ↘ @hearth/domain (rules, dates)   │   │ infrastructure → application     │
          └──────────────────────────────────────────┘   └──────────────────────────────────┘
                      @hearth/contracts → @hearth/domain (types only)
                      @hearth/domain → nothing
```

- `@hearth/domain` imports **nothing** (enforced by ESLint `no-restricted-imports`). It is the
  inner ring of the hexagon and is shared by both apps so a rule ("what is overdue", "how a
  burndown is computed", "who may change roles") is written once.
- `@hearth/contracts` is the wire format. The API validates every request body/query with these
  zod schemas; the web app imports the same TypeScript types. Changing a contract breaks the
  build on both sides.
- `@hearth/ui` is presentation-only: no data fetching, no routing, no app state.

## API: modular monolith, hexagonal per bounded context

`apps/api/src/modules/<context>/` — one NestJS module per bounded context, registered once in
`modules/index.ts`:

| Context      | Owns                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `identity`   | register, login (JWT), me, profile                                                              |
| `workspace`  | member directory (read), teams, tags, app-shell summary                                         |
| `tasks`      | task aggregate, list/detail read models, quick add, comments, dependencies, followers, activity |
| `projects`   | projects, sections, milestones, favorites, health, board/list ordering                          |
| `timeline`   | Gantt read model, critical path, schedule conflicts, drag-to-reschedule with dependents         |
| `workload`   | capacity vs planned hours per person per day, time off, rebalance suggestions                   |
| `sprints`    | sprints, backlog ranking, burndown snapshots, velocity, capacity warnings, completion           |
| `inbox`      | notifications (from domain events), approvals, snooze/archive/read                              |
| `search`     | ⌘K server-side search across tasks, projects, people                                            |
| `ai`         | summaries and task breakdowns (adapter: local heuristic or Anthropic), always as suggestions    |
| `reporting`  | dashboard KPIs, created-vs-completed, status mix, project health                                |
| `members`    | invites, role changes, deactivate/reactivate, permission matrix                                 |
| `billing`    | plans, subscription, usage meters, limit checks, upgrade/downgrade/pause                        |
| `onboarding` | getting-started checklist                                                                       |

Inside every context:

```
<context>/
├─ <context>.module.ts
├─ application/
│  ├─ commands/   <verb-noun>.command.ts + <verb-noun>.handler.ts   (write side)
│  ├─ queries/    <get-noun>.query.ts + <get-noun>.handler.ts       (read side)
│  └─ events/     <noun>-<happened>.handler.ts                      (reactions to domain events)
├─ infrastructure/
│  ├─ prisma-<aggregate>.repository.ts   implements a domain repository port
│  └─ <noun>.read-model.ts               Prisma queries that return contract DTOs directly
└─ presentation/
   └─ <context>.controller.ts            thin: validate → dispatch command/query → return DTO
```

- **Controllers** never contain business logic. They validate with `ZodValidationPipe(<Schema>)`,
  build a Command/Query and hand it to the `CommandBus`/`QueryBus`.
- **Command handlers** load an aggregate through a repository **port**, call behavior methods,
  save, then publish the aggregate's domain events.
- **Query handlers** use read models (CQRS read side) — plain Prisma queries mapped to DTOs. They
  never load aggregates.
- **Event handlers** react to domain events across contexts (task assigned → inbox notification,
  activity log, realtime broadcast, sprint snapshot). Contexts never call each other's
  repositories directly.
- **Authorization**: every route is authenticated by the global JWT guard; `@RequirePermission()`
  checks the domain `AccessPolicy` (role matrix + guest project scope) for the request's
  `Actor` (user, workspace, role). Use `@Public()` only for auth endpoints.
- **Errors**: throw `DomainError` subclasses from `@hearth/domain`; the global exception filter
  maps them to the `ApiErrorBody` envelope with the right HTTP status. Messages are written for
  people (what happened, why, how to fix).
- **Time**: inject the `CLOCK` token (`Clock` from the domain) — never call `new Date()` in
  handlers, so tests can freeze time.

## Web: feature-sliced

```
apps/web/src/
├─ app/            providers, router, app shell (sidebar, top bar), feature registry
├─ shared/         api client (facade), auth store, hotkeys, commands, realtime, toasts, hooks
└─ features/<f>/   index.ts (routes + commands), api.ts (query hooks), components/, pages/
```

- Each feature exports `routes` and `commands` from its `index.ts`; `app/feature-registry.ts`
  collects them. Features import from `shared/`, `@hearth/ui`, `@hearth/contracts`,
  `@hearth/domain` and from another feature **only through that feature's `index.ts`**.
- Server state lives in TanStack Query; UI state in small Zustand stores or component state.
  Mutations are **optimistic** and roll back with a toast that explains what happened.
- Real-time: the socket client turns domain events into query invalidations.
- Keyboard-first: every action is a `Command` (palette + shortcut). Shortcuts follow the design
  system's keyboard map.

## Design patterns (where and why)

| Pattern                           | Where                                                             | Why                                                              |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Aggregate / Entity / Value object | `domain/task/task.ts`, `TaskKey`                                  | invariants live with the data they protect                       |
| Repository (port + adapters)      | `TaskRepository` → `PrismaTaskRepository`, in-memory in tests     | Dependency Inversion; handlers are testable without a DB         |
| CQRS                              | `@nestjs/cqrs` command/query handlers                             | write model enforces rules, read models stay fast and DTO-shaped |
| Observer / domain events          | `AggregateRoot.record()` → `EventBus` → event handlers, websocket | contexts react to each other without coupling                    |
| State                             | `domain/task/task-status-state.ts`                                | each status owns its entry/exit effects (OCP)                    |
| Specification                     | `domain/task/task-specifications.ts`                              | composable filters shared by API and web                         |
| Strategy                          | grouping/sorting (`task-grouping.ts`), AI providers, plan limits  | swap algorithms behind one interface                             |
| Factory                           | `Task.create`, `taskStatusState()`, `TASK_GROUPINGS`              | one place to build valid objects                                 |
| Interpreter                       | `quick-add-parser.ts`                                             | the “@sara #website !high tomorrow” mini-language                |
| Chain of responsibility           | `AccessPolicy` rules                                              | add access rules without editing others                          |
| Command                           | web `Command` objects (⌘K, shortcuts), undoable mutations         | one action model for palette, keys and menus                     |
| Adapter                           | Prisma repositories, `AiProvider` implementations, socket bridge  | isolate third parties                                            |
| Facade                            | web `api` client                                                  | features call `api.tasks.update()` not `fetch`                   |
| Builder                           | `buildTaskSpecification`, test data builders                      | readable construction of composite objects                       |
| Decorator                         | `@RequirePermission`, `@CurrentActor`                             | cross-cutting concerns stay out of handlers                      |
| Mediator                          | Command/Query buses                                               | controllers don't know handlers                                  |

## SOLID in practice

- **S** — one handler per use case; controllers only translate HTTP; read models only read.
- **O** — new status, grouping, access rule, AI provider or plan = a new class registered in a map.
- **L** — every repository adapter (Prisma, in-memory) passes the same handler tests.
- **I** — small ports (`TaskRepository`, `Clock`, `AiProvider`, `FilterableTask`) instead of god interfaces.
- **D** — handlers depend on ports injected by token (`TASK_REPOSITORY`, `CLOCK`), never on Prisma.

## Testing

- `packages/domain`: pure unit tests (vitest) for every rule and domain service.
- `apps/api`: handler unit tests with in-memory repositories (`*.spec.ts` next to the code) and
  e2e tests against a real PostgreSQL (`test/*.e2e-spec.ts`, supertest).
- `apps/web` and `packages/ui`: component tests with Testing Library for interactive behavior.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit and e2e tests with a Postgres service.

## Conventions

- TypeScript strict everywhere. No `any` without a comment explaining why.
- Dates: calendar dates are `YYYY-MM-DD` strings on the wire and midnight-UTC `Date`s in the
  domain (`parseDateOnly`, `toDateOnly`). Timestamps are ISO strings.
- Copy follows the design system voice: sentence case, verbs on buttons, human dates, errors that
  explain how to fix.
- Colors, spacing, radii and type always come from tokens (`var(--…)`), never hex values.
- Accessibility: WCAG 2.2 AA — real buttons/links/inputs, labels, focus rings, focus trapping in
  dialogs, `aria-live` for toasts, color never the only signal.
