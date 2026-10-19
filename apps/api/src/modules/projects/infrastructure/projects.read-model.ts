import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  BoardDto,
  HealthMetaDto,
  MilestoneDto,
  ProjectDetailDto,
  ProjectMemberDto,
  ProjectSummaryDto,
  SectionDto,
  WipLimitsDto,
} from '@hearth/contracts';
import {
  evaluateHealth,
  HEALTH_META,
  largestSlip,
  NotFoundError,
  parseWipLimits,
  projectProgress,
  startOfDay,
  STATUS_META,
  TASK_STATUSES,
  wipLevel,
  type Actor,
  type Clock,
  type ProjectHealth,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { accent, dateOnly, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';
import { TASK_CARD_INCLUDE, toTaskDto } from './task-dto.mapper';

const SUMMARY_INCLUDE = {
  owner: { select: USER_REF_SELECT },
  team: { select: { id: true, name: true, color: true } },
  tasks: { where: { parentId: null }, select: { status: true, dueDate: true } },
} satisfies Prisma.ProjectInclude;
type SummaryRow = Prisma.ProjectGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

export const healthMeta = (health: ProjectHealth): HealthMetaDto => ({ health, ...HEALTH_META[health] });

/**
 * Read side of the projects context: index rows, the project detail (overview + header), board
 * columns and a team's projects. Plain Prisma → contract DTOs; never loads aggregates.
 */
@Injectable()
export class ProjectsReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Guests only ever see projects they were invited to. */
  visibleWhere(actor: Actor): Prisma.ProjectWhereInput {
    return {
      workspaceId: actor.workspaceId,
      archivedAt: null,
      ...(actor.role === 'GUEST' ? { id: { in: [...(actor.projectIds ?? [])] } } : {}),
    };
  }

  async list(actor: Actor, extra: Prisma.ProjectWhereInput = {}): Promise<ProjectSummaryDto[]> {
    const [rows, favorites] = await Promise.all([
      this.prisma.project.findMany({ where: { AND: [this.visibleWhere(actor), extra] }, include: SUMMARY_INCLUDE, orderBy: [{ createdAt: 'asc' }] }),
      this.prisma.favorite.findMany({ where: { userId: actor.userId }, select: { projectId: true } }),
    ]);
    const fav = new Set(favorites.map((f) => f.projectId));
    return rows.map((r) => this.toSummary(r, fav.has(r.id)));
  }

  async teamProjects(actor: Actor, teamId: string): Promise<ProjectSummaryDto[]> {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, workspaceId: actor.workspaceId }, select: { id: true } });
    if (!team) throw new NotFoundError('Team', teamId);
    return this.list(actor, { teamId });
  }

  async detail(actor: Actor, projectId: string): Promise<ProjectDetailDto> {
    const row = await this.prisma.project.findFirst({
      where: { AND: [this.visibleWhere(actor), { id: projectId }] },
      include: {
        ...SUMMARY_INCLUDE,
        sections: { orderBy: { position: 'asc' }, include: { _count: { select: { tasks: { where: { parentId: null } } } } } },
        milestones: { orderBy: { date: 'asc' }, include: { dependsOn: { select: { taskId: true } } } },
        team: { select: { id: true, name: true, color: true, members: { select: { user: { select: USER_REF_SELECT } } } } },
        members: { select: { user: { select: USER_REF_SELECT } } },
      },
    });
    if (!row) throw new NotFoundError('Project', projectId);

    const [favorite, assigned, slipRows, keyPrefix] = await Promise.all([
      this.prisma.favorite.findUnique({ where: { userId_projectId: { userId: actor.userId, projectId } } }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { projectId, parentId: null, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.task.findMany({
        where: { projectId, parentId: null, baselineStart: { not: null }, startDate: { not: null } },
        select: { id: true, number: true, title: true, status: true, startDate: true, baselineStart: true },
      }),
      this.keyPrefix(actor.workspaceId),
    ]);
    const openAssigned = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: { projectId, parentId: null, assigneeId: { not: null }, status: { not: 'DONE' } },
      _count: { _all: true },
    });

    const summary = this.toSummary(row, !!favorite);
    const today = startOfDay(this.clock.now());
    const suggested = evaluateHealth(
      {
        totalTasks: summary.counts.total,
        doneTasks: summary.counts.done,
        overdueTasks: summary.counts.overdue,
        blockedTasks: summary.counts.blocked,
        startDate: row.startDate,
        dueDate: row.dueDate,
      },
      today,
    );

    const members = await this.members(row, assigned.map((a) => a.assigneeId!), new Map(openAssigned.map((a) => [a.assigneeId!, a._count._all])));
    const slip = largestSlip(slipRows.map((t) => ({ ...t, start: t.startDate, done: t.status === 'DONE' })));

    return {
      ...summary,
      description: row.description,
      sections: row.sections.map((s): SectionDto => ({ id: s.id, name: s.name, position: s.position, taskCount: s._count.tasks })),
      milestones: row.milestones.map(
        (m): MilestoneDto => ({ id: m.id, name: m.name, date: dateOnly(m.date)!, done: !!m.doneAt, dependsOnTaskIds: m.dependsOn.map((d) => d.taskId) }),
      ),
      members,
      wipLimits: parseWipLimits(row.wipLimits) as WipLimitsDto,
      suggestedHealth: { ...healthMeta(suggested.health), reason: suggested.reason },
      budgetUsedPct: row.budgetUsedPct,
      slip: slip ? { taskId: slip.task.id, key: `${keyPrefix}-${slip.task.number}`, title: slip.task.title, days: slip.days } : null,
    };
  }

  async board(actor: Actor, projectId: string): Promise<BoardDto> {
    const project = await this.prisma.project.findFirst({ where: { AND: [this.visibleWhere(actor), { id: projectId }] }, select: { id: true, wipLimits: true } });
    if (!project) throw new NotFoundError('Project', projectId);
    const [tasks, keyPrefix] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId, parentId: null },
        include: TASK_CARD_INCLUDE,
        orderBy: [{ boardPosition: 'asc' }, { number: 'asc' }],
      }),
      this.keyPrefix(actor.workspaceId),
    ]);
    const limits = parseWipLimits(project.wipLimits);
    return {
      projectId,
      columns: TASK_STATUSES.map((status) => {
        const items = tasks.filter((t) => t.status === status).map((t) => toTaskDto(t, keyPrefix));
        const limit = limits[status] ?? null;
        return { status, label: STATUS_META[status].label, count: items.length, wipLimit: limit, wipLevel: wipLevel(items.length, limit), tasks: items };
      }),
    };
  }

  private async members(
    row: { ownerId: string; owner: Parameters<typeof toUserRef>[0]; team: { members: { user: Parameters<typeof toUserRef>[0] }[] } | null; members: { user: Parameters<typeof toUserRef>[0] }[] },
    assigneeIds: string[],
    openCounts: Map<string, number>,
  ): Promise<ProjectMemberDto[]> {
    const people = new Map<string, Parameters<typeof toUserRef>[0]>();
    people.set(row.owner.id, row.owner);
    for (const m of row.team?.members ?? []) people.set(m.user.id, m.user);
    for (const m of row.members) people.set(m.user.id, m.user);
    const missing = assigneeIds.filter((id) => !people.has(id));
    if (missing.length) {
      const users = await this.prisma.user.findMany({ where: { id: { in: missing } }, select: USER_REF_SELECT });
      for (const u of users) people.set(u.id, u);
    }
    return [...people.values()]
      .map((u) => ({ ...toUserRef(u), openTasks: openCounts.get(u.id) ?? 0, isOwner: u.id === row.ownerId }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || b.openTasks - a.openTasks || a.name.localeCompare(b.name));
  }

  private toSummary(r: SummaryRow, isFavorite: boolean): ProjectSummaryDto {
    const today = startOfDay(this.clock.now()).getTime();
    const total = r.tasks.length;
    const done = r.tasks.filter((t) => t.status === 'DONE').length;
    const overdue = r.tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate.getTime() < today).length;
    const blocked = r.tasks.filter((t) => t.status === 'BLOCKED').length;
    return {
      id: r.id,
      name: r.name,
      color: accent(r.color, 'blue'),
      icon: r.icon,
      owner: toUserRef(r.owner),
      team: r.team ? { id: r.team.id, name: r.team.name, color: accent(r.team.color) } : null,
      health: healthMeta(r.health),
      progress: projectProgress({ totalTasks: total, doneTasks: done }),
      counts: { total, open: total - done, done, overdue, blocked },
      startDate: dateOnly(r.startDate),
      dueDate: dateOnly(r.dueDate),
      isFavorite,
    };
  }

  private async keyPrefix(workspaceId: string): Promise<string> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { keyPrefix: true } });
    return ws?.keyPrefix ?? 'HRT';
  }
}
