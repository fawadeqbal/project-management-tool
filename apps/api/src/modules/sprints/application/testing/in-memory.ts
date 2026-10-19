import type { SprintTaskDto } from '@hearth/contracts';
import { Sprint, type DomainEvent, type SprintRepository } from '@hearth/domain';
import type { SprintSnapshotStore, SprintTaskFacts, SprintTaskStore } from '../sprints.ports';

/** In-memory adapters for handler tests (they pass the same tests as the Prisma ones). */
export class InMemorySprintRepository implements SprintRepository {
  readonly rows = new Map<string, Sprint>();

  constructor(sprints: Sprint[] = []) {
    for (const s of sprints) this.rows.set(s.id, s);
  }
  async findById(workspaceId: string, id: string) {
    const s = this.rows.get(id);
    return s && s.toSnapshot().workspaceId === workspaceId ? s : null;
  }
  async findActive(projectId: string) {
    return [...this.rows.values()].find((s) => s.projectId === projectId && s.status === 'ACTIVE') ?? null;
  }
  async findNextPlanned(projectId: string, afterNumber: number) {
    return (
      [...this.rows.values()].filter((s) => s.projectId === projectId && s.status === 'PLANNED' && s.number > afterNumber).sort((a, b) => a.number - b.number)[0] ??
      null
    );
  }
  async nextNumber(projectId: string) {
    return Math.max(0, ...[...this.rows.values()].filter((s) => s.projectId === projectId).map((s) => s.number)) + 1;
  }
  async save(sprint: Sprint) {
    this.rows.set(sprint.id, sprint);
  }
}

export type MemTask = SprintTaskDto & { projectId: string };

export class InMemorySprintTaskStore implements SprintTaskStore {
  constructor(readonly tasks: MemTask[]) {}
  async findTask(_w: string, taskId: string): Promise<SprintTaskFacts | null> {
    const t = this.tasks.find((x) => x.id === taskId);
    return t ? { id: t.id, projectId: t.projectId, sprintId: t.sprintId, points: t.points, status: t.status, backlogRank: t.backlogRank } : null;
  }
  async itemsInSprint(sprintId: string) {
    return this.tasks.filter((t) => t.sprintId === sprintId);
  }
  async moveToSprint(ids: readonly string[], sprintId: string) {
    for (const t of this.tasks) if (ids.includes(t.id)) t.sprintId = sprintId;
  }
  async moveToBacklog(entries: readonly { taskId: string; rank: number }[]) {
    for (const e of entries) {
      const t = this.tasks.find((x) => x.id === e.taskId)!;
      t.sprintId = null;
      t.backlogRank = e.rank;
    }
  }
  async topBacklogRank(projectId: string) {
    const ranks = this.tasks.filter((t) => t.projectId === projectId && !t.sprintId && t.backlogRank != null).map((t) => t.backlogRank!);
    return ranks.length ? Math.min(...ranks) : null;
  }
  async setBacklogRank(taskId: string, rank: number) {
    this.tasks.find((t) => t.id === taskId)!.backlogRank = rank;
  }
}

export class InMemorySnapshotStore implements SprintSnapshotStore {
  readonly rows = new Map<string, { remainingPoints: number; scopePoints: number }>();
  constructor(private readonly repo: InMemorySprintRepository) {}
  async activeSprintIds(projectId: string) {
    return [...this.repo.rows.values()].filter((s) => s.projectId === projectId && s.status === 'ACTIVE').map((s) => s.id);
  }
  async statusOf(sprintId: string) {
    return this.repo.rows.get(sprintId)?.status ?? null;
  }
  async upsert(sprintId: string, date: Date, remainingPoints: number, scopePoints: number) {
    this.rows.set(`${sprintId}:${date.toISOString().slice(0, 10)}`, { remainingPoints, scopePoints });
  }
}

/** Captures published events instead of sending them to the bus. */
export class FakePublisher {
  readonly events: DomainEvent[] = [];
  publish(...events: DomainEvent[]) {
    this.events.push(...events);
  }
  publishFrom(...aggregates: { pullEvents(): DomainEvent[] }[]) {
    for (const a of aggregates) this.events.push(...a.pullEvents());
  }
}

export const task = (id: string, over: Partial<MemTask> = {}): MemTask => ({
  id,
  key: `HRT-${id}`,
  title: `Task ${id}`,
  status: 'TODO',
  priority: 'MEDIUM',
  points: 3,
  assignee: null,
  epic: null,
  sprintId: null,
  backlogRank: null,
  projectId: 'p1',
  ...over,
});
