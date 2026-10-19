import { Inject, Injectable } from '@nestjs/common';
import type { TimelineDto, TimelineQuery, TimelineRowDto, TimelineTaskRowDto } from '@hearth/contracts';
import {
  addDays,
  computeCriticalPath,
  findScheduleConflicts,
  NotFoundError,
  parseDateOnly,
  startOfDay,
  toDateOnly,
  type Actor,
  type Clock,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { dateOnly, toUserRef, USER_REF_SELECT } from '../../../shared/mappers/refs';
import { PrismaScheduleAdapter } from './prisma-schedule.adapter';

const NO_SECTION = 'no-section';

/**
 * Gantt read model: rows in section order (each section's scheduled tasks, then the milestones
 * they gate), dependency links, the critical path and schedule conflicts — computed with the
 * domain's planning services over the whole project, then filtered to the requested window.
 */
@Injectable()
export class TimelineReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: PrismaScheduleAdapter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async timeline(actor: Actor, projectId: string, range: TimelineQuery): Promise<TimelineDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: actor.workspaceId,
        archivedAt: null,
        // Guests only see projects they were invited to (AND keeps both id conditions).
        ...(actor.role === 'GUEST' ? { AND: [{ id: { in: [...(actor.projectIds ?? [])] } }] } : {}),
      },
      select: {
        id: true,
        workspace: { select: { keyPrefix: true } },
        sections: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
      },
    });
    if (!project) throw new NotFoundError('Project', projectId);
    const prefix = project.workspace.keyPrefix;

    const [graph, tasks, milestones] = await Promise.all([
      this.schedule.projectSchedule(projectId, prefix),
      this.prisma.task.findMany({
        where: { projectId, parentId: null, startDate: { not: null }, dueDate: { not: null } },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          sectionId: true,
          startDate: true,
          dueDate: true,
          baselineStart: true,
          baselineDue: true,
          progress: true,
          listPosition: true,
          assignee: { select: USER_REF_SELECT },
        },
        orderBy: [{ startDate: 'asc' }, { listPosition: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.milestone.findMany({
        where: { projectId },
        orderBy: { date: 'asc' },
        include: { dependsOn: { select: { taskId: true } } },
      }),
    ]);

    const today = startOfDay(this.clock.now());
    const cpm = computeCriticalPath(graph.items, graph.edges);
    const critical = new Set(cpm.criticalIds);
    const conflicts = findScheduleConflicts(graph.items, graph.edges);
    const labelOf = new Map(graph.items.map((i) => [i.id, i.label]));

    // Window: explicit, or from the week before today (Sun-aligned) to a week past the last date,
    // at least six weeks — the design's default "Week" view.
    const dates = [...tasks.map((t) => t.dueDate!), ...milestones.map((m) => m.date), today];
    const maxDate = new Date(Math.max(...dates.map((x) => x.getTime())));
    const weekBefore = addDays(today, -7);
    const from = range.from ? parseDateOnly(range.from) : addDays(weekBefore, -weekBefore.getUTCDay());
    const minEnd = addDays(from, 41);
    const end = maxDate.getTime() > minEnd.getTime() ? maxDate : minEnd;
    const to = range.to
      ? parseDateOnly(range.to)
      : addDays(end, 6 - end.getUTCDay() + (end === maxDate ? 7 : 0));
    const inWindow = (s: Date, e: Date) => e.getTime() >= from.getTime() && s.getTime() <= to.getTime();

    const taskRows = tasks
      .filter((t) => inWindow(t.startDate!, t.dueDate!))
      .map((t): TimelineTaskRowDto => ({
        kind: 'task',
        id: t.id,
        key: `${prefix}-${t.number}`,
        title: t.title,
        status: t.status,
        sectionId: t.sectionId,
        startDate: toDateOnly(t.startDate!),
        dueDate: toDateOnly(t.dueDate!),
        baselineStart: dateOnly(t.baselineStart),
        baselineDue: dateOnly(t.baselineDue),
        progress: t.status === 'DONE' ? 100 : t.progress,
        assignee: t.assignee ? toUserRef(t.assignee) : null,
        critical: critical.has(t.id),
      }));

    // A milestone sits after the last section holding one of the tasks it waits on.
    const sectionIds = [...project.sections.map((s) => s.id), NO_SECTION];
    const sectionOfTask = new Map(
      (await this.prisma.task.findMany({ where: { projectId }, select: { id: true, sectionId: true } })).map(
        (t) => [t.id, t.sectionId ?? NO_SECTION],
      ),
    );
    const milestoneSection = (taskIds: string[]) => {
      const idx = taskIds
        .map((id) => sectionIds.indexOf(sectionOfTask.get(id) ?? NO_SECTION))
        .filter((i) => i >= 0);
      return idx.length ? sectionIds[Math.max(...idx)]! : sectionIds[sectionIds.length - 1]!;
    };

    const rows: TimelineRowDto[] = [];
    const sections = [...project.sections, { id: NO_SECTION, name: 'No section' }];
    for (const section of sections) {
      const own = taskRows.filter((t) => (t.sectionId ?? NO_SECTION) === section.id);
      const gates = milestones.filter(
        (m) => inWindow(m.date, m.date) && milestoneSection(m.dependsOn.map((d) => d.taskId)) === section.id,
      );
      if (!own.length && !gates.length) continue;
      if (section.id !== NO_SECTION || rows.length)
        rows.push({ kind: 'section', id: section.id, name: section.name });
      rows.push(...own);
      rows.push(
        ...gates.map((m) => ({
          kind: 'milestone' as const,
          id: m.id,
          name: m.name,
          date: toDateOnly(m.date),
          done: !!m.doneAt,
          critical: critical.has(m.id),
        })),
      );
    }

    const visible = new Set(rows.map((r) => r.id));
    return {
      projectId,
      from: toDateOnly(from),
      to: toDateOnly(to),
      today: toDateOnly(today),
      rows,
      links: graph.edges
        .filter((e) => visible.has(e.blockerId) && visible.has(e.blockedId))
        .map((e) => ({
          fromId: e.blockerId,
          toId: e.blockedId,
          critical: critical.has(e.blockerId) && critical.has(e.blockedId),
        })),
      criticalIds: cpm.criticalIds,
      conflicts: conflicts.map((c) => ({ ...c, blockerKey: labelOf.get(c.blockerId) ?? null })),
    };
  }
}
