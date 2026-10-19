import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActivityDto, CommentDto, ListTasksQuery, TaskDetailDto, TaskDto, TaskRefDto, UserRefDto } from '@hearth/contracts';
import { NotFoundError, parseDateOnly, startOfDay, ValidationError, type Actor, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { accent, dateOnly, iso, PROJECT_REF_SELECT, toProjectRef, toTaskRef, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';
import { resolveMentions } from '../application/mentions';
import { activitySummary, isHiddenActivity } from './activity-summary';

const TASK_REF_SELECT = { id: true, number: true, title: true, status: true } as const;

const TASK_INCLUDE = {
  assignee: { select: USER_REF_SELECT },
  project: { select: PROJECT_REF_SELECT },
  tags: { include: { tag: true } },
  blockedBy: { include: { blocker: { select: TASK_REF_SELECT } } },
  _count: { select: { comments: true, subtasks: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

const COMMENT_INCLUDE = { author: { select: USER_REF_SELECT } } satisfies Prisma.CommentInclude;
type CommentRow = Prisma.CommentGetPayload<{ include: typeof COMMENT_INCLUDE }>;

interface MemberRef extends UserRefDto {
  email: string;
}

const ACTIVITY_LIMIT = 50;
const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/;

/**
 * CQRS read side of the tasks context: Prisma queries mapped straight to contract DTOs.
 * Every list is batched (one task query + one groupBy for done subtasks), never N+1.
 * Exported for other contexts (search, timeline, sprints, inbox) to reuse the TaskDto shape.
 */
@Injectable()
export class TaskReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Lists, boards, calendars, timelines and workload all read through this one filter. */
  async list(actor: Actor, query: ListTasksQuery): Promise<TaskDto[]> {
    const rows = await this.prisma.task.findMany({
      where: this.listWhere(actor, query),
      include: TASK_INCLUDE,
      orderBy: [{ listPosition: 'asc' }, { createdAt: 'asc' }],
      take: query.limit,
    });
    return this.toDtos(actor.workspaceId, rows);
  }

  /** Tasks by id (same shape as `list`), in the order given. Unknown ids are skipped. */
  async byIds(workspaceId: string, ids: readonly string[]): Promise<TaskDto[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.task.findMany({ where: { workspaceId, id: { in: [...ids] } }, include: TASK_INCLUDE });
    const dtos = new Map((await this.toDtos(workspaceId, rows)).map((t) => [t.id, t]));
    return ids.map((id) => dtos.get(id)).filter((t): t is TaskDto => !!t);
  }

  async get(workspaceId: string, id: string): Promise<TaskDto> {
    const [dto] = await this.byIds(workspaceId, [id]);
    if (!dto) throw new NotFoundError('Task', id);
    return dto;
  }

  /** Resolves "HRT-188" (or a bare number) to a task id in the workspace. */
  async idForKey(workspaceId: string, key: string): Promise<string> {
    const number = parseKeyNumber(key);
    const row = number
      ? await this.prisma.task.findUnique({ where: { workspaceId_number: { workspaceId, number } }, select: { id: true, workspace: { select: { keyPrefix: true } } } })
      : null;
    const prefix = KEY_PATTERN.exec(key.trim())?.[1]?.toUpperCase();
    if (!row || (prefix && prefix !== row.workspace.keyPrefix)) throw new NotFoundError('Task', key);
    return row.id;
  }

  /**
   * Full task for the side panel: description, subtasks, comments, activity, dependencies.
   * `idOrKey` is a task id or a key like "HRT-188". Access checks are the caller's job.
   */
  async detail(actor: Pick<Actor, 'workspaceId'>, idOrKey: string): Promise<TaskDetailDto> {
    const workspaceId = actor.workspaceId;
    const id = KEY_PATTERN.test(idOrKey.trim()) ? await this.idForKey(workspaceId, idOrKey) : idOrKey;
    const row = await this.prisma.task.findFirst({
      where: { id, workspaceId },
      include: {
        ...TASK_INCLUDE,
        creator: { select: USER_REF_SELECT },
        sprint: { select: { id: true, name: true } },
        blocking: { include: { blocked: { select: TASK_REF_SELECT } } },
        followers: { select: { userId: true } },
      },
    });
    if (!row) throw new NotFoundError('Task', id);

    const [keyPrefix, subtaskRows, commentRows, activityRows, members] = await Promise.all([
      this.keyPrefix(workspaceId),
      this.prisma.task.findMany({ where: { parentId: id, workspaceId }, include: TASK_INCLUDE, orderBy: [{ listPosition: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.comment.findMany({ where: { taskId: id }, include: COMMENT_INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.prisma.activity.findMany({
        where: { taskId: id },
        include: { actor: { select: USER_REF_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT * 2, // hidden rows (reorders) are filtered below
      }),
      this.members(workspaceId),
    ]);

    const [base] = await this.toDtos(workspaceId, [row], keyPrefix);
    const subtasks = await this.toDtos(workspaceId, subtaskRows, keyPrefix);
    const names = new Map(members.map((m) => [m.id, m.name]));
    const activity: ActivityDto[] = activityRows
      .filter((a) => !isHiddenActivity(a.type, asRecord(a.payload)))
      .slice(0, ACTIVITY_LIMIT)
      .reverse()
      .map((a) => ({
        id: a.id,
        type: a.type,
        actor: toUserRef(a.actor),
        summary: activitySummary(a.type, asRecord(a.payload), (uid) => names.get(uid)),
        createdAt: a.createdAt.toISOString(),
      }));

    return {
      ...base!,
      description: row.description,
      creator: toUserRef(row.creator),
      subtasks,
      comments: commentRows.map((c) => toCommentDto(c, members)),
      activity,
      blocking: row.blocking.map((d) => toTaskRef(d.blocked, keyPrefix)),
      followerIds: row.followers.map((f) => f.userId),
      sprint: row.sprint,
    };
  }

  async comment(workspaceId: string, commentId: string): Promise<CommentDto> {
    const [row, members] = await Promise.all([
      this.prisma.comment.findFirst({ where: { id: commentId, task: { workspaceId } }, include: COMMENT_INCLUDE }),
      this.members(workspaceId),
    ]);
    if (!row) throw new NotFoundError('Comment', commentId);
    return toCommentDto(row, members);
  }

  // ── Internals ─────────────────────────────────────────────

  private listWhere(actor: Actor, q: ListTasksQuery): Prisma.TaskWhereInput {
    const and: Prisma.TaskWhereInput[] = [{ workspaceId: actor.workspaceId }];

    if (q.scope === 'mine') and.push({ assigneeId: actor.userId });
    if (q.scope === 'project' && !q.projectId)
      throw new ValidationError('tasks.project_required', 'Pick a project to list its tasks.', { field: 'projectId' });
    if (q.projectId) and.push({ projectId: q.projectId });
    if (q.sprintId) and.push({ sprintId: q.sprintId });
    // Guests only ever see the projects they were invited to.
    if (actor.role === 'GUEST') and.push({ projectId: { in: [...(actor.projectIds ?? [])] } });

    const includeDone = q.includeDone ?? q.scope === 'project';
    if (q.statuses?.length) and.push({ status: { in: q.statuses } });
    else if (!includeDone) and.push({ status: { not: 'DONE' } });
    if (q.priorities?.length) and.push({ priority: { in: q.priorities } });

    if (q.assigneeIds?.length) {
      const ids = q.assigneeIds.filter((a) => a !== 'none');
      const or: Prisma.TaskWhereInput[] = [];
      if (ids.length) or.push({ assigneeId: { in: ids } });
      if (ids.length !== q.assigneeIds.length) or.push({ assigneeId: null });
      and.push({ OR: or });
    }

    if (q.tags?.length)
      and.push({ tags: { some: { OR: q.tags.map((name) => ({ tag: { name: { equals: name, mode: 'insensitive' as const } } })) } } });

    const range = rangeFilter(q.from, q.to);
    if (range) and.push(range);

    if (q.overdue) and.push({ status: { not: 'DONE' }, dueDate: { lt: startOfDay(this.clock.now()) } });

    if (q.q?.trim()) {
      const text = q.q.trim();
      const number = parseKeyNumber(text);
      and.push({ OR: [{ title: { contains: text, mode: 'insensitive' } }, ...(number ? [{ number }] : [])] });
    }

    if (q.parentId) and.push({ parentId: q.parentId });
    else if (!q.includeSubtasks) and.push({ parentId: null });

    return { AND: and };
  }

  private async toDtos(workspaceId: string, rows: TaskRow[], prefix?: string): Promise<TaskDto[]> {
    if (!rows.length) return [];
    const withSubtasks = rows.filter((r) => r._count.subtasks > 0).map((r) => r.id);
    const [keyPrefix, doneCounts] = await Promise.all([
      prefix ?? this.keyPrefix(workspaceId),
      withSubtasks.length
        ? this.prisma.task.groupBy({ by: ['parentId'], where: { parentId: { in: withSubtasks }, status: 'DONE' }, _count: { _all: true } })
        : Promise.resolve([]),
    ]);
    const done = new Map(doneCounts.map((g) => [g.parentId, g._count._all]));
    return rows.map((r) => toTaskDto(r, keyPrefix, done.get(r.id) ?? 0));
  }

  private async keyPrefix(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { keyPrefix: true } });
    if (!ws) throw new NotFoundError('Workspace', workspaceId);
    return ws.keyPrefix;
  }

  private async members(workspaceId: string): Promise<MemberRef[]> {
    const rows = await this.prisma.membership.findMany({
      where: { workspaceId },
      select: { status: true, user: { select: { ...USER_REF_SELECT, email: true } } },
      orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((m) => ({ ...toUserRef(m.user), email: m.user.email }));
  }
}

const toTaskDto = (r: TaskRow, keyPrefix: string, subtaskDoneCount: number): TaskDto => ({
  id: r.id,
  key: `${keyPrefix}-${r.number}`,
  number: r.number,
  title: r.title,
  status: r.status,
  priority: r.priority,
  assigneeId: r.assigneeId,
  assignee: r.assignee ? toUserRef(r.assignee) : null,
  projectId: r.projectId,
  project: r.project ? toProjectRef(r.project) : null,
  sectionId: r.sectionId,
  parentId: r.parentId,
  sprintId: r.sprintId,
  startDate: dateOnly(r.startDate),
  dueDate: dateOnly(r.dueDate),
  estimatePoints: r.estimatePoints,
  estimateHours: r.estimateHours,
  progress: r.progress,
  epic: r.epic,
  tags: r.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: accent(t.tag.color) })).sort((a, b) => a.name.localeCompare(b.name)),
  commentCount: r._count.comments,
  subtaskCount: r._count.subtasks,
  subtaskDoneCount,
  blockedBy: r.blockedBy.map((d): TaskRefDto => toTaskRef(d.blocker, keyPrefix)),
  boardPosition: r.boardPosition,
  listPosition: r.listPosition,
  backlogRank: r.backlogRank,
  completedAt: iso(r.completedAt),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toCommentDto = (c: CommentRow, members: readonly MemberRef[]): CommentDto => ({
  id: c.id,
  taskId: c.taskId,
  author: toUserRef(c.author),
  body: c.body,
  parentId: c.parentId,
  mentions: resolveMentions(c.body, members).map(({ email: _email, ...ref }) => ref),
  createdAt: c.createdAt.toISOString(),
  editedAt: iso(c.editedAt),
});

/** "HRT-188", "hrt-188", "#188" or "188" → 188. */
export const parseKeyNumber = (value: string): number | null => {
  const m = /^(?:[A-Za-z][A-Za-z0-9]*-|#)?(\d{1,9})$/.exec(value.trim());
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** A task overlaps [from, to] when its start or due date falls inside it, or it spans the whole range. */
const rangeFilter = (fromStr?: string, toStr?: string): Prisma.TaskWhereInput | null => {
  const from = fromStr ? parseDateOnly(fromStr) : undefined;
  const to = toStr ? parseDateOnly(toStr) : undefined;
  if (!from && !to) return null;
  const within = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const or: Prisma.TaskWhereInput[] = [{ startDate: within }, { dueDate: within }];
  if (from && to) or.push({ startDate: { lte: from }, dueDate: { gte: to } });
  return { OR: or };
};

const asRecord = (v: Prisma.JsonValue): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
