import { Injectable } from '@nestjs/common';
import type { DependencyEdge } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  ProjectSchedule,
  ScheduleItem,
  ScheduleReader,
  ScheduleUpdate,
  ScheduleWriter,
} from '../application/schedule.ports';

type TaskRow = {
  id: string;
  number: number;
  projectId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  status: string;
};
type MilestoneRow = { id: string; name: string; projectId: string; date: Date; doneAt: Date | null };

export const taskItem = (t: TaskRow, prefix: string): ScheduleItem | null => {
  const start = t.startDate ?? t.dueDate;
  const end = t.dueDate ?? t.startDate;
  if (!start || !end) return null;
  return {
    id: t.id,
    kind: 'task',
    label: `${prefix}-${t.number}`,
    projectId: t.projectId,
    start,
    end,
    startDate: t.startDate,
    dueDate: t.dueDate,
    done: t.status === 'DONE',
  };
};

export const milestoneItem = (m: MilestoneRow): ScheduleItem => ({
  id: m.id,
  kind: 'milestone',
  label: m.name,
  projectId: m.projectId,
  start: m.date,
  end: m.date,
  startDate: m.date,
  dueDate: m.date,
  done: !!m.doneAt,
});

const TASK_SELECT = {
  id: true,
  number: true,
  projectId: true,
  startDate: true,
  dueDate: true,
  status: true,
} as const;

/** Prisma adapter for the timeline's schedule ports (reads the graph, writes dates in one transaction). */
@Injectable()
export class PrismaScheduleAdapter implements ScheduleReader, ScheduleWriter {
  constructor(private readonly prisma: PrismaService) {}

  private async prefix(workspaceId: string): Promise<string> {
    return (
      (await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { keyPrefix: true } }))
        ?.keyPrefix ?? 'HRT'
    );
  }

  async scheduleForTask(
    workspaceId: string,
    taskId: string,
  ): Promise<{ task: ScheduleItem; schedule: ProjectSchedule } | null> {
    const row = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId }, select: TASK_SELECT });
    if (!row) return null;
    const prefix = await this.prefix(workspaceId);
    const self: ScheduleItem = taskItem(row, prefix) ?? {
      id: row.id,
      kind: 'task',
      label: `${prefix}-${row.number}`,
      projectId: row.projectId,
      start: new Date(0),
      end: new Date(0),
      startDate: null,
      dueDate: null,
    };
    if (!row.projectId) return { task: self, schedule: { projectId: null, items: [self], edges: [] } };
    const schedule = await this.projectSchedule(row.projectId, prefix);
    const task = schedule.items.find((i) => i.id === row.id) ?? self;
    if (!schedule.items.some((i) => i.id === row.id)) schedule.items.push(self);
    return { task, schedule };
  }

  async projectSchedule(projectId: string, prefix: string): Promise<ProjectSchedule> {
    const [tasks, milestones, deps, links] = await Promise.all([
      this.prisma.task.findMany({ where: { projectId }, select: TASK_SELECT }),
      this.prisma.milestone.findMany({ where: { projectId } }),
      this.prisma.taskDependency.findMany({ where: { blocker: { projectId }, blocked: { projectId } } }),
      this.prisma.milestoneDependency.findMany({ where: { milestone: { projectId } } }),
    ]);
    const items = [
      ...tasks.map((t) => taskItem(t, prefix)).filter((x): x is ScheduleItem => !!x),
      ...milestones.map(milestoneItem),
    ];
    const edges: DependencyEdge[] = [
      ...deps.map((d) => ({ blockerId: d.blockerId, blockedId: d.blockedId })),
      ...links.map((l) => ({ blockerId: l.taskId, blockedId: l.milestoneId })),
    ];
    return { projectId, items, edges };
  }

  async itemsByIds(
    workspaceId: string,
    refs: { kind: 'task' | 'milestone'; id: string }[],
  ): Promise<ScheduleItem[]> {
    const taskIds = refs.filter((r) => r.kind === 'task').map((r) => r.id);
    const milestoneIds = refs.filter((r) => r.kind === 'milestone').map((r) => r.id);
    const [prefix, tasks, milestones] = await Promise.all([
      this.prefix(workspaceId),
      this.prisma.task.findMany({ where: { id: { in: taskIds }, workspaceId }, select: TASK_SELECT }),
      this.prisma.milestone.findMany({ where: { id: { in: milestoneIds }, project: { workspaceId } } }),
    ]);
    return [
      ...tasks.map(
        (t) =>
          taskItem(t, prefix) ?? {
            id: t.id,
            kind: 'task' as const,
            label: `${prefix}-${t.number}`,
            projectId: t.projectId,
            start: new Date(0),
            end: new Date(0),
            startDate: null,
            dueDate: null,
          },
      ),
      ...milestones.map(milestoneItem),
    ];
  }

  async apply(updates: ScheduleUpdate[]): Promise<void> {
    if (!updates.length) return;
    await this.prisma.$transaction(
      updates.map((u) =>
        u.kind === 'task'
          ? this.prisma.task.update({
              where: { id: u.id },
              data: { startDate: u.startDate, dueDate: u.dueDate },
            })
          : this.prisma.milestone.update({ where: { id: u.id }, data: { date: u.dueDate ?? u.startDate! } }),
      ),
    );
  }
}
