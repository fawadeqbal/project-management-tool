import type { DomainEvent, DependencyEdge, TaskStatus, Actor, Role, AggregateRoot } from '@hearth/domain';
import { FixedClock } from '@hearth/domain';
import { AccessService } from '../../../shared/access/access.service';
import type { DomainEventPublisher } from '../../../shared/events/domain-event.publisher';
import type { TaskReadModel } from '../infrastructure/task.read-model';
import { InMemoryTaskRepository } from '../infrastructure/in-memory-task.repository';
import type {
  MemberHandle,
  MissingReference,
  ProjectHandle,
  TaskDirectory,
  TaskOrdering,
  TaskReferences,
  TaskRelations,
} from '../application/ports';

/** Test doubles for the tasks handlers (no Nest, no database). */

export const WS = 'ws-1';
export const TODAY = new Date('2026-10-19T09:00:00Z');

export const MEMBERS: MemberHandle[] = [
  { id: 'u-fawad', name: 'Fawad Iqbal', initials: 'FI', email: 'fawad@acme.com' },
  { id: 'u-sara', name: 'Sara Ahmed', initials: 'SA', email: 'sara@acme.com' },
  { id: 'u-mo', name: 'Mo Khan', initials: 'MK', email: 'mo@acme.com' },
];
export const PROJECTS: ProjectHandle[] = [
  { id: 'p-web', name: 'Website relaunch' },
  { id: 'p-brand', name: 'Q4 brand campaign' },
  { id: 'p-mobile', name: 'Mobile app v2' },
];

export const actorOf = (role: Role = 'OWNER', userId = 'u-fawad', projectIds?: string[]): Actor => ({
  userId,
  workspaceId: WS,
  role,
  projectIds,
});

/** Captures published events instead of sending them over the EventBus. */
export class FakePublisher {
  readonly events: DomainEvent[] = [];
  publish(...events: DomainEvent[]): void {
    this.events.push(...events);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors DomainEventPublisher
  publishFrom(...aggregates: AggregateRoot<any>[]): void {
    for (const a of aggregates) this.publish(...a.pullEvents());
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
  asPublisher(): DomainEventPublisher {
    return this as unknown as DomainEventPublisher;
  }
}

export class InMemoryTaskDirectory implements TaskDirectory {
  constructor(
    readonly members: MemberHandle[] = MEMBERS,
    readonly projectList: ProjectHandle[] = PROJECTS,
    private readonly tasks?: InMemoryTaskRepository,
  ) {}
  async activeMembers(): Promise<MemberHandle[]> {
    return this.members;
  }
  async projects(_ws: string, onlyIds?: readonly string[]): Promise<ProjectHandle[]> {
    return onlyIds ? this.projectList.filter((p) => onlyIds.includes(p.id)) : this.projectList;
  }
  async findMissingReference(_ws: string, refs: TaskReferences): Promise<MissingReference | null> {
    if (refs.projectId && !this.projectList.some((p) => p.id === refs.projectId))
      return { entity: 'Project', id: refs.projectId };
    if (refs.assigneeId && !this.members.some((m) => m.id === refs.assigneeId))
      return { entity: 'Member', id: refs.assigneeId };
    if (refs.parentId && this.tasks && !(await this.tasks.findById(WS, refs.parentId)))
      return { entity: 'Task', id: refs.parentId };
    return null;
  }
  async projectOfTask(ws: string, taskId: string): Promise<string | null | undefined> {
    const t = await this.tasks?.findById(ws, taskId);
    return t ? t.projectId : undefined;
  }
}

export class InMemoryTaskRelations implements TaskRelations {
  readonly ordering = new Map<string, TaskOrdering>();
  readonly tags = new Map<string, string[]>();
  readonly followers = new Map<string, Set<string>>();
  readonly edges: DependencyEdge[] = [];
  readonly comments: Array<{
    id: string;
    taskId: string;
    authorId: string;
    body: string;
    parentId: string | null;
  }> = [];
  readonly epics = new Map<string, string | null>();

  constructor(private readonly tasks: InMemoryTaskRepository) {}

  async lastPositions(
    _ws: string,
    scope: { projectId: string | null; status: TaskStatus; parentId: string | null },
  ) {
    const all = this.tasks.all().map((t) => t.toSnapshot());
    const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
    return {
      board: max(
        all
          .filter((t) => t.projectId === scope.projectId && t.status === scope.status && !t.parentId)
          .map((t) => this.ordering.get(t.id)?.boardPosition ?? 0),
      ),
      list: max(
        all
          .filter((t) => t.projectId === scope.projectId && t.parentId === scope.parentId)
          .map((t) => this.ordering.get(t.id)?.listPosition ?? 0),
      ),
    };
  }
  async positionsOf(_ws: string, ids: readonly string[]) {
    return new Map(ids.filter((id) => this.ordering.has(id)).map((id) => [id, this.ordering.get(id)!]));
  }
  async setOrdering(taskId: string, ordering: Partial<TaskOrdering>) {
    this.ordering.set(taskId, {
      boardPosition: 0,
      listPosition: 0,
      ...this.ordering.get(taskId),
      ...ordering,
    });
  }
  async setEpic(taskId: string, epic: string | null) {
    this.epics.set(taskId, epic);
  }
  async replaceTags(taskId: string, tagIds: readonly string[]) {
    this.tags.set(taskId, [...tagIds]);
  }
  async follow(taskId: string, userIds: readonly string[]) {
    const set = this.followers.get(taskId) ?? new Set<string>();
    userIds.forEach((u) => set.add(u));
    this.followers.set(taskId, set);
  }
  async unfollow(taskId: string, userId: string) {
    this.followers.get(taskId)?.delete(userId);
  }
  async subtaskStatuses(parentId: string) {
    return this.tasks
      .all()
      .map((t) => t.toSnapshot())
      .filter((t) => t.parentId === parentId)
      .map((t) => t.status);
  }
  async dependencyEdges() {
    return [...this.edges];
  }
  async addDependency(edge: DependencyEdge) {
    if (!this.edges.some((e) => e.blockerId === edge.blockerId && e.blockedId === edge.blockedId))
      this.edges.push(edge);
  }
  async removeDependency(edge: DependencyEdge) {
    const i = this.edges.findIndex((e) => e.blockerId === edge.blockerId && e.blockedId === edge.blockedId);
    if (i >= 0) this.edges.splice(i, 1);
    return i >= 0;
  }
  async findComment(taskId: string, commentId: string) {
    return this.comments.find((c) => c.taskId === taskId && c.id === commentId) ?? null;
  }
  async createComment(input: { taskId: string; authorId: string; body: string; parentId: string | null }) {
    const id = `c-${this.comments.length + 1}`;
    this.comments.push({ id, ...input });
    return { id };
  }
}

/** Read model stub: echoes ids back so handler tests don't need Prisma. */
export const stubReadModel = (tasks: InMemoryTaskRepository): TaskReadModel =>
  ({
    get: async (_ws: string, id: string) => {
      const t = await tasks.findById(WS, id);
      return t ? { ...t.toSnapshot() } : null;
    },
    detail: async (_actor: unknown, id: string) => {
      const t = await tasks.findById(WS, id);
      return t ? { ...t.toSnapshot() } : null;
    },
    comment: async (_ws: string, id: string) => ({ id }),
  }) as unknown as TaskReadModel;

export function createKit() {
  const tasks = new InMemoryTaskRepository({ [WS]: 'HRT' });
  tasks.setSequence(WS, 327);
  const relations = new InMemoryTaskRelations(tasks);
  const directory = new InMemoryTaskDirectory(MEMBERS, PROJECTS, tasks);
  const publisher = new FakePublisher();
  const clock = new FixedClock(TODAY);
  const access = new AccessService();
  const read = stubReadModel(tasks);
  let seq = 0;
  const newId = () => `t-${++seq}`;
  return { tasks, relations, directory, publisher, clock, access, read, newId };
}
export type TaskTestKit = ReturnType<typeof createKit>;

/** Builds the creation service (shared by create and quick add) on the kit's fakes. */
export const creationServiceOf = async (kit: TaskTestKit) => {
  const { TaskCreationService } = await import('../application/task-creation.service');
  return new TaskCreationService(
    kit.tasks,
    kit.directory,
    kit.relations,
    kit.clock,
    kit.access,
    kit.publisher.asPublisher(),
    kit.newId,
  );
};
