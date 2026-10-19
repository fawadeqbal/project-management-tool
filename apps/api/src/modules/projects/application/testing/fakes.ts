import { AccessPolicy, type DomainEvent, type Project, type ProjectRepository } from '@hearth/domain';
import type { AccessService } from '../../../../shared/access/access.service';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { FavoriteStore, MilestoneRecord, MilestoneStore, TeamDirectory } from '../projects.ports';

/** In-memory adapters shared by the projects handler specs (same contract as the Prisma ones). */
export class InMemoryProjectRepository implements ProjectRepository {
  readonly saved = new Map<string, Project>();
  private seq = 0;
  nextId() {
    return `p${++this.seq}`;
  }
  nextSectionId() {
    return `s${++this.seq}`;
  }
  async findById(workspaceId: string, id: string) {
    const p = this.saved.get(id);
    return p && p.workspaceId === workspaceId ? p : null;
  }
  async findBySectionId(workspaceId: string, sectionId: string) {
    return (
      [...this.saved.values()].find(
        (p) => p.workspaceId === workspaceId && p.sections.some((s) => s.id === sectionId),
      ) ?? null
    );
  }
  async save(project: Project) {
    this.saved.set(project.id, project);
  }
}

export class InMemoryFavorites implements FavoriteStore {
  readonly rows = new Set<string>();
  async add(userId: string, projectId: string) {
    this.rows.add(`${userId}:${projectId}`);
  }
  async remove(userId: string, projectId: string) {
    this.rows.delete(`${userId}:${projectId}`);
  }
}

export class InMemoryMilestones implements MilestoneStore {
  readonly rows = new Map<string, MilestoneRecord>();
  constructor(
    private readonly projectOf: (id: string) => string | undefined = () => undefined,
    readonly tasksByProject: Record<string, string[]> = {},
  ) {}
  private seq = 0;
  nextId() {
    return `m${++this.seq}`;
  }
  async findById(_ws: string, id: string) {
    const m = this.rows.get(id);
    return m && (this.projectOf(m.projectId) ?? true)
      ? { ...m, dependsOnTaskIds: [...m.dependsOnTaskIds] }
      : null;
  }
  async save(m: MilestoneRecord) {
    this.rows.set(m.id, { ...m });
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async tasksInProject(projectId: string, taskIds: string[]) {
    return taskIds.filter((id) => this.tasksByProject[projectId]?.includes(id));
  }
}

export const teams = (ids: string[] = ['t1']): TeamDirectory => ({
  exists: async (_w, id) => ids.includes(id),
});

export const realAccess = (): AccessService => {
  const policy = new AccessPolicy();
  return {
    allows: policy.allows.bind(policy),
    assert: policy.assert.bind(policy),
  } as unknown as AccessService;
};

export class CapturingPublisher {
  readonly events: DomainEvent[] = [];
  publish(...events: DomainEvent[]) {
    this.events.push(...events);
  }
  publishFrom(...aggregates: { pullEvents(): DomainEvent[] }[]) {
    for (const a of aggregates) this.events.push(...a.pullEvents());
  }
  get types() {
    return this.events.map((e) => e.type);
  }
  asPublisher(): DomainEventPublisher {
    return this as unknown as DomainEventPublisher;
  }
}
