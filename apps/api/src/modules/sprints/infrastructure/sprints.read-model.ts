import { Inject, Injectable } from '@nestjs/common';
import type { SprintDetailDto, SprintSummaryDto, SprintTaskDto, UserRefDto } from '@hearth/contracts';
import {
  NotFoundError,
  averageVelocity,
  computeBurndown,
  formatShortDate,
  sprintCapacity,
  sprintSnapshotOf,
  suggestDeferral,
  toDateOnly,
  weekdayName,
  workingDaysBetween,
  type Actor,
  type Clock,
} from '@hearth/domain';
import type { Sprint as SprintRow, SprintSnapshot } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { SPRINT_TASK_SELECT, toSprintTaskDto } from './sprint-task.mapper';

type SprintWithFacts = SprintRow & {
  snapshots: SprintSnapshot[];
  tasks: { status: SprintTaskDto['status']; estimatePoints: number | null }[];
};

const VELOCITY_WINDOW = 3;

/** Read side of the sprints context: sprint list, sprint detail (burndown, velocity, capacity) and the backlog. */
@Injectable()
export class SprintsReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(actor: Actor, projectId: string): Promise<SprintSummaryDto[]> {
    await this.assertProject(actor, projectId);
    const rows = await this.prisma.sprint.findMany({
      where: { projectId },
      include: {
        snapshots: { orderBy: { date: 'asc' } },
        tasks: { select: { status: true, estimatePoints: true } },
      },
      orderBy: { number: 'asc' },
    });
    return rows.map((r) => this.summary(r));
  }

  async detail(actor: Actor, sprintId: string): Promise<SprintDetailDto> {
    const row = await this.prisma.sprint.findFirst({
      where: { id: sprintId, project: { workspaceId: actor.workspaceId } },
      select: { projectId: true },
    });
    if (!row) throw new NotFoundError('Sprint', sprintId);
    const all = await this.prisma.sprint.findMany({
      where: { projectId: row.projectId },
      include: {
        snapshots: { orderBy: { date: 'asc' } },
        tasks: { select: { status: true, estimatePoints: true } },
      },
      orderBy: { number: 'asc' },
    });
    const sprint = all.find((s) => s.id === sprintId)!;
    const taskRows = await this.prisma.task.findMany({
      where: { sprintId },
      select: SPRINT_TASK_SELECT,
      orderBy: [{ number: 'asc' }],
    });
    const tasks = taskRows.map(toSprintTaskDto);
    const summaries = all.map((s) => this.summary(s));
    const summary = summaries.find((s) => s.id === sprintId)!;
    const today = this.clock.now();

    // Burndown: committed scope before start is the planned scope.
    const committed = sprint.status === 'PLANNED' ? summary.scopePoints : sprint.committedPoints;
    const burndown = computeBurndown(
      { startDate: sprint.startDate, endDate: sprint.endDate, committedPoints: committed },
      sprint.snapshots.map((s) => ({
        date: s.date,
        remainingPoints: s.remainingPoints,
        scopePoints: s.scopePoints,
      })),
      today,
    );
    const last = burndown.actual[burndown.actual.length - 1];
    const behindBy = last
      ? Math.round((last.remaining - (burndown.ideal[last.day]?.remaining ?? 0)) * 10) / 10
      : 0;
    const maxPoints = Math.max(
      committed,
      ...burndown.actual.map((a) => a.remaining),
      ...sprint.snapshots.map((s) => s.scopePoints),
      0,
    );

    // Velocity: completed sprints before this one, plus this sprint's plan (its current scope).
    const completedBefore = summaries.filter((s) => s.status === 'COMPLETED' && s.number < sprint.number);
    const velocity = averageVelocity(
      completedBefore.map((s) => s.completedPoints),
      VELOCITY_WINDOW,
    );
    const bars = completedBefore.slice(-4).map((s) => ({
      sprintId: s.id,
      number: s.number,
      label: `S${s.number}`,
      points: s.completedPoints,
      isPlan: false,
    }));
    const isOpen = sprint.status !== 'COMPLETED';
    bars.push({
      sprintId: sprint.id,
      number: sprint.number,
      label: `S${sprint.number}`,
      points: isOpen ? summary.scopePoints : summary.completedPoints,
      isPlan: isOpen,
    });

    const commitment = isOpen ? summary.scopePoints : sprint.committedPoints;
    const cap = sprintCapacity(commitment, velocity);
    const excess = commitment - velocity;
    const defer = cap.level === 'over' ? suggestDeferral(tasks, excess) : null;
    const message = defer
      ? `Committed ${excess} ${excess === 1 ? 'point' : 'points'} above your ${Math.min(VELOCITY_WINDOW, completedBefore.length)}-sprint average. Consider moving ${defer.key} back to the backlog.`
      : cap.message;

    const people = new Map<string, UserRefDto>();
    for (const t of tasks) if (t.assignee) people.set(t.assignee.id, t.assignee);

    const { remainingPoints, scopePoints } = sprintSnapshotOf(tasks);
    const donePoints = scopePoints - remainingPoints;

    return {
      sprint: summary,
      header: {
        dateLabel: `${formatShortDate(sprint.startDate)} – ${formatShortDate(sprint.endDate)}`,
        daysLeft: burndown.daysLeft,
        statusLabel: this.statusLabel(sprint, burndown.daysLeft, today),
        people: [...people.values()],
      },
      tasks,
      progress: {
        donePoints,
        totalPoints: scopePoints,
        donePct: scopePoints ? Math.round((donePoints / scopePoints) * 100) : 0,
      },
      burndown: {
        days: workingDaysBetween(sprint.startDate, sprint.endDate).map(toDateOnly),
        totalDays: burndown.totalDays,
        ideal: burndown.ideal,
        actual: burndown.actual,
        scopeChanges: burndown.scopeChanges,
        todayIndex: burndown.todayIndex,
        onPace: burndown.onPace,
        behindBy,
        projectedFinishDay: burndown.projectedFinishDay,
        daysLeft: burndown.daysLeft,
        maxPoints,
      },
      velocity: { bars, average: velocity },
      capacity: {
        committed: commitment,
        velocity,
        level: cap.level,
        ratio: Math.round(cap.ratio * 100) / 100,
        message,
        deferTask: defer
          ? { id: defer.id, key: defer.key, title: defer.title, points: defer.points ?? 0 }
          : null,
      },
      scopeChanges: burndown.scopeChanges.map((c) => ({
        date: c.date,
        label: `${formatShortDate(new Date(c.date + 'T00:00:00Z'))} · +${c.addedPoints} pts`,
        addedPoints: c.addedPoints,
      })),
      sprints: summaries,
    };
  }

  async backlog(actor: Actor, projectId: string): Promise<SprintTaskDto[]> {
    await this.assertProject(actor, projectId);
    const rows = await this.prisma.task.findMany({
      where: {
        projectId,
        sprintId: null,
        backlogRank: { not: null },
        status: { not: 'DONE' },
        parentId: null,
      },
      select: SPRINT_TASK_SELECT,
      orderBy: [{ backlogRank: 'asc' }, { number: 'asc' }],
    });
    return rows.map(toSprintTaskDto);
  }

  private summary(r: SprintWithFacts): SprintSummaryDto {
    const items = r.tasks.map((t) => ({ status: t.status, points: t.estimatePoints }));
    const { remainingPoints, scopePoints } = sprintSnapshotOf(items);
    const final = r.snapshots[r.snapshots.length - 1];
    // A completed sprint's record is its final snapshot (unfinished work has moved on since).
    const completedPoints =
      r.status === 'COMPLETED' && final
        ? final.scopePoints - final.remainingPoints
        : scopePoints - remainingPoints;
    return {
      id: r.id,
      projectId: r.projectId,
      number: r.number,
      name: r.name,
      goal: r.goal,
      status: r.status,
      startDate: toDateOnly(r.startDate),
      endDate: toDateOnly(r.endDate),
      committedPoints: r.committedPoints,
      completedPoints,
      scopePoints: r.status === 'COMPLETED' && final ? final.scopePoints : scopePoints,
      taskCount: r.tasks.length,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    };
  }

  private statusLabel(s: SprintRow, daysLeft: number, today: Date): string {
    if (s.status === 'COMPLETED') return `Completed ${formatShortDate(s.completedAt ?? s.endDate)}`;
    if (s.status === 'PLANNED')
      return s.startDate.getTime() > today.getTime()
        ? `Planned · starts ${weekdayName(s.startDate)} ${formatShortDate(s.startDate)}`
        : 'Planned · ready to start';
    if (daysLeft === 0) return 'Active · last day';
    return `Active · ${daysLeft} working ${daysLeft === 1 ? 'day' : 'days'} left`;
  }

  private async assertProject(actor: Actor, projectId: string): Promise<void> {
    const exists = await this.prisma.project.count({
      where: { id: projectId, workspaceId: actor.workspaceId },
    });
    if (!exists) throw new NotFoundError('Project', projectId);
  }
}
