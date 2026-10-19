import { Inject, Injectable } from '@nestjs/common';
import type { DashboardDto, DashboardQuery, ProjectHealthRowDto } from '@hearth/contracts';
import {
  addDays,
  budgetTone,
  computeKpis,
  diffInDays,
  evaluateHealth,
  HEALTH_META,
  NotFoundError,
  projectProgress,
  REPORT_RANGE_META,
  startOfDay,
  statusMix,
  throughputVerdict,
  weeklyThroughput,
  type Actor,
  type Clock,
  type ProjectHealth,
  type ReportTask,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { dateOnly, toProjectRef, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';
import { DashboardPreferencesStore } from './dashboard-preferences.store';

const BLOCKED_STALE_DAYS = 3;

/**
 * Read side of the Dashboard (CQRS): plain Prisma reads folded through the domain's reporting
 * rules (computeKpis, weeklyThroughput, statusMix, evaluateHealth) into the contract DTO.
 */
@Injectable()
export class DashboardReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prefs: DashboardPreferencesStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(actor: Actor, query: DashboardQuery): Promise<DashboardDto> {
    const now = this.clock.now();
    const today = startOfDay(now);
    const { weeks, phrase } = REPORT_RANGE_META[query.range];
    const projectFilter = query.projectId ? { id: query.projectId } : {};

    const projects = await this.prisma.project.findMany({
      where: { workspaceId: actor.workspaceId, archivedAt: null, ...projectFilter },
      include: { owner: { select: USER_REF_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    if (query.projectId && !projects.length) throw new NotFoundError('Project', query.projectId);

    const [tasks, layout, schedule] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          workspaceId: actor.workspaceId,
          ...(query.projectId
            ? { projectId: query.projectId }
            : { OR: [{ projectId: null }, { project: { archivedAt: null } }] }),
        },
        select: {
          status: true,
          createdAt: true,
          startDate: true,
          dueDate: true,
          completedAt: true,
          projectId: true,
          updatedAt: true,
        },
      }),
      this.prefs.layout(actor.workspaceId, actor.userId),
      this.prefs.schedule(actor.workspaceId, actor.userId),
    ]);

    const reportTasks: ReportTask[] = tasks;
    const throughput = weeklyThroughput(reportTasks, today, weeks);
    const rows = projects.map((p) =>
      this.healthRow(
        p,
        tasks.filter((t) => t.projectId === p.id),
        today,
      ),
    );

    return {
      title: query.projectId ? projects[0]!.name : `Q${Math.floor(today.getUTCMonth() / 3) + 1} portfolio`,
      range: query.range,
      rangeLabel: phrase,
      projectCount: projects.length,
      kpis: computeKpis(reportTasks, today, weeks),
      throughput,
      throughputVerdict: throughputVerdict(throughput),
      statusMix: statusMix(reportTasks),
      blockedNote: this.blockedNote(tasks, projects, now),
      projects: rows,
      layout,
      schedule,
      generatedAt: now.toISOString(),
    };
  }

  private healthRow(
    p: {
      id: string;
      name: string;
      color: string;
      health: string;
      startDate: Date | null;
      dueDate: Date | null;
      budgetUsedPct: number | null;
      owner: { id: string; name: string; initials: string; avatarColor: string };
    },
    tasks: { status: string; dueDate: Date | null }[],
    today: Date,
  ): ProjectHealthRowDto {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && diffInDays(today, t.dueDate) < 0,
    ).length;
    const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
    const progress = projectProgress({ totalTasks, doneTasks });
    const suggestion = evaluateHealth(
      { totalTasks, doneTasks, overdueTasks, blockedTasks, startDate: p.startDate, dueDate: p.dueDate },
      today,
    );
    const health = p.health as ProjectHealth;
    return {
      project: toProjectRef(p),
      health,
      healthMeta: HEALTH_META[health],
      suggestedHealth: suggestion.health,
      suggestedReason: suggestion.reason,
      owner: toUserRef(p.owner),
      progress,
      totalTasks,
      doneTasks,
      due: dateOnly(p.dueDate),
      budgetUsedPct: p.budgetUsedPct,
      budgetTone: budgetTone(p.budgetUsedPct, progress),
    };
  }

  /** "6 tasks blocked for more than 3 days — 4 of them in Mobile app v2." */
  private blockedNote(
    tasks: { status: string; projectId: string | null; updatedAt: Date }[],
    projects: { id: string; name: string }[],
    now: Date,
  ): string | null {
    const blocked = tasks.filter((t) => t.status === 'BLOCKED');
    if (!blocked.length) return null;
    const stale = blocked.filter((t) => t.updatedAt.getTime() <= addDays(now, -BLOCKED_STALE_DAYS).getTime());
    const list = stale.length ? stale : blocked;
    const byProject = new Map<string, number>();
    for (const t of list) if (t.projectId) byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + 1);
    const [topId, topCount] = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const top = projects.find((p) => p.id === topId);
    const head = `${list.length} task${list.length === 1 ? '' : 's'} blocked ${stale.length ? `for more than ${BLOCKED_STALE_DAYS} days` : 'right now'}`;
    if (!top || list.length === 1) return `${head}${top ? ` in ${top.name}` : ''}.`;
    return `${head} — ${topCount === list.length ? 'all' : `${topCount} of them`} in ${top.name}.`;
  }
}
