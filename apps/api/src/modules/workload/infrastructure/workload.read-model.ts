import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WORKLOAD_SOURCE, type TimeOffDto, type TimeOffQuery, type UserRefDto, type WorkloadDto, type WorkloadQuery, type WorkloadTaskDto } from '@hearth/contracts';
import {
  addDays,
  computeWorkload,
  formatShortDate,
  isToday,
  parseDateOnly,
  suggestRebalance,
  summarizeWorkload,
  workloadDays,
  type Actor,
  type Clock,
  type WorkloadTask,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { dateOnly, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';
import { dayLabel, dayRangeLabel, mondayOf } from '../application/day-labels';

/**
 * Read side of the workload context: who is planned for how much, per working day, against
 * capacity. Pure Prisma reads mapped through the domain's computeWorkload/summarize/suggest.
 */
@Injectable()
export class WorkloadReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async workload(actor: Actor, query: WorkloadQuery): Promise<WorkloadDto> {
    const today = this.clock.now();
    const monday = mondayOf(today);
    const from = query.from ? parseDateOnly(query.from) : monday;
    const to = query.to ? parseDateOnly(query.to) : addDays(mondayOf(from), 11);
    const weekEnd = addDays(mondayOf(from), 4);

    const [workspace, members] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId }, select: { keyPrefix: true } }),
      this.prisma.membership.findMany({
        where: {
          workspaceId: actor.workspaceId,
          status: 'ACTIVE',
          role: { not: 'GUEST' },
          ...(query.teamId ? { user: { teamMemberships: { some: { teamId: query.teamId } } } } : {}),
        },
        include: { user: { select: { ...USER_REF_SELECT, jobTitle: true } } },
      }),
    ]);

    let people = members;
    if (query.projectId) {
      // A project's workload: its team plus anyone with open work in it. Load still counts all
      // of their work — capacity belongs to the person, not the project.
      const project = await this.prisma.project.findFirstOrThrow({
        where: { id: query.projectId, workspaceId: actor.workspaceId },
        select: { team: { select: { members: { select: { userId: true } } } } },
      });
      const assignees = await this.prisma.task.findMany({
        where: { projectId: query.projectId, status: { not: 'DONE' }, assigneeId: { not: null } },
        select: { assigneeId: true },
        distinct: ['assigneeId'],
      });
      const ids = new Set([...(project.team?.members.map((m) => m.userId) ?? []), ...assignees.map((a) => a.assigneeId!)]);
      people = members.filter((m) => ids.has(m.userId));
    }
    // Seniority order from the design: by join date, then name.
    people.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.user.name.localeCompare(b.user.name));
    const userIds = people.map((p) => p.userId);

    const [taskRows, timeOffRows] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          workspaceId: actor.workspaceId,
          assigneeId: { in: userIds },
          status: { not: 'DONE' },
          // Parents are planned through their subtasks — don't count the hours twice.
          subtasks: { none: {} },
          OR: [
            { startDate: { lte: to }, dueDate: { gte: from } },
            { startDate: null, dueDate: { gte: from, lte: to } },
            { dueDate: null, startDate: { gte: from, lte: to } },
          ],
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          projectId: true,
          assigneeId: true,
          estimateHours: true,
          estimatePoints: true,
          startDate: true,
          dueDate: true,
        },
      }),
      this.prisma.timeOff.findMany({ where: { workspaceId: actor.workspaceId, userId: { in: userIds }, startDate: { lte: to }, endDate: { gte: from } } }),
    ]);

    const key = (n: number) => `${workspace.keyPrefix}-${n}`;
    const domainTasks: WorkloadTask[] = taskRows.map((t) => ({
      id: t.id,
      key: key(t.number),
      title: t.title,
      assigneeId: t.assigneeId,
      startDate: t.startDate,
      dueDate: t.dueDate,
      estimateHours: t.estimateHours,
      estimatePoints: t.estimatePoints,
    }));
    const personInputs = people.map((p) => ({ userId: p.userId, capacityHoursPerDay: p.capacityHoursPerDay }));
    const timeOff = timeOffRows.map((t) => ({ userId: t.userId, startDate: t.startDate, endDate: t.endDate }));
    const rows = computeWorkload(personInputs, domainTasks, timeOff, { from, to }, query.unit);
    const summary = summarizeWorkload(rows);

    const refs = new Map<string, UserRefDto>(people.map((p) => [p.userId, toUserRef(p.user)]));
    const firstNames = Object.fromEntries(people.map((p) => [p.userId, p.user.name.split(' ')[0]!]));
    // Suggestions always reason in hours over this week — "based on this week's estimates".
    const weekRows = computeWorkload(personInputs, domainTasks, timeOff, { from, to: weekEnd < to ? weekEnd : to }, 'hours');
    const taskById = new Map(taskRows.map((t) => [t.id, t]));
    const suggestions = suggestRebalance(weekRows, domainTasks, firstNames).flatMap((s) => {
      const task = taskById.get(s.taskId);
      const fromRef = refs.get(s.fromUserId);
      const toRef = refs.get(s.toUserId);
      if (!task || !fromRef || !toRef) return [];
      return [
        {
          id: `${s.taskId}:${s.toUserId}`,
          task: { id: task.id, key: key(task.number), title: task.title },
          from: fromRef,
          to: toRef,
          days: s.days,
          dayLabel: dayRangeLabel(s.days),
          hours: s.totalHours,
          fromLoadPct: s.fromLoadPct,
          fromLoadPctAfter: s.fromLoadPctAfter,
          toLoadPct: s.toLoadPct,
          toLoadPctAfter: s.toLoadPctAfter,
          reason: s.reason,
          source: WORKLOAD_SOURCE,
        },
      ];
    });

    const days = workloadDays(from, to);
    const tasks: Record<string, WorkloadTaskDto> = {};
    for (const t of taskRows)
      tasks[t.id] = {
        id: t.id,
        key: key(t.number),
        title: t.title,
        status: t.status,
        projectId: t.projectId,
        assigneeId: t.assigneeId,
        estimateHours: t.estimateHours,
        estimatePoints: t.estimatePoints,
        startDate: dateOnly(t.startDate),
        dueDate: dateOnly(t.dueDate),
      };

    return {
      range: { from: dateOnly(from)!, to: dateOnly(to)!, label: `${formatShortDate(from)} – ${formatShortDate(to)}` },
      unit: query.unit,
      days: days.map((date, i) => ({ date, label: dayLabel(date), isToday: isToday(date, today), weekStart: i > 0 && parseDateOnly(date).getUTCDay() === 1 })),
      people: rows.map((r, i) => ({
        user: refs.get(r.userId)!,
        jobTitle: people[i]!.user.jobTitle,
        capacityHoursPerDay: people[i]!.capacityHoursPerDay,
        cells: r.cells,
        plannedTotal: r.plannedTotal,
        capacityTotal: r.capacityTotal,
        loadPct: r.loadPct,
        overDays: r.overDays,
      })),
      tasks,
      summary: {
        capacityUsedPct: summary.capacityUsedPct,
        planned: summary.planned,
        capacity: summary.capacity,
        overCapacity: summary.overCapacity.map((o) => ({ user: refs.get(o.userId)!, days: o.days, label: dayRangeLabel(o.days) })),
        freeCapacity: summary.freeCapacity,
        freeBy: summary.freeBy.map((f) => ({ user: refs.get(f.userId)!, free: f.free })),
        timeOff: summary.timeOff.map((o) => ({ user: refs.get(o.userId)!, days: o.days, label: dayRangeLabel(o.days, true) })),
      },
      suggestions,
    };
  }

  async timeOff(workspaceId: string, query: TimeOffQuery): Promise<TimeOffDto[]> {
    const where: Prisma.TimeOffWhereInput = { workspaceId };
    if (query.userId) where.userId = query.userId;
    if (query.to) where.startDate = { lte: parseDateOnly(query.to) };
    if (query.from) where.endDate = { gte: parseDateOnly(query.from) };
    const rows = await this.prisma.timeOff.findMany({ where, include: { user: { select: USER_REF_SELECT } }, orderBy: [{ startDate: 'asc' }] });
    return rows.map(toTimeOffDto);
  }
}

export const toTimeOffDto = (t: { id: string; startDate: Date; endDate: Date; reason: string | null; user: { id: string; name: string; initials: string; avatarColor: string } }): TimeOffDto => ({
  id: t.id,
  user: toUserRef(t.user),
  startDate: dateOnly(t.startDate)!,
  endDate: dateOnly(t.endDate)!,
  reason: t.reason,
});
