import { Injectable } from '@nestjs/common';
import type { SprintTaskDto } from '@hearth/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { SprintTaskFacts, SprintTaskStore } from '../application/sprints.ports';
import { SPRINT_TASK_SELECT, toSprintTaskDto } from './sprint-task.mapper';

@Injectable()
export class PrismaSprintTaskStore implements SprintTaskStore {
  constructor(private readonly prisma: PrismaService) {}

  async findTask(workspaceId: string, taskId: string): Promise<SprintTaskFacts | null> {
    const t = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: {
        id: true,
        projectId: true,
        sprintId: true,
        estimatePoints: true,
        status: true,
        backlogRank: true,
      },
    });
    return t
      ? {
          id: t.id,
          projectId: t.projectId,
          sprintId: t.sprintId,
          points: t.estimatePoints,
          status: t.status,
          backlogRank: t.backlogRank,
        }
      : null;
  }

  async itemsInSprint(sprintId: string): Promise<SprintTaskDto[]> {
    const rows = await this.prisma.task.findMany({
      where: { sprintId },
      select: SPRINT_TASK_SELECT,
      orderBy: { number: 'asc' },
    });
    return rows.map(toSprintTaskDto);
  }

  async moveToSprint(taskIds: readonly string[], sprintId: string): Promise<void> {
    await this.prisma.task.updateMany({ where: { id: { in: [...taskIds] } }, data: { sprintId } });
  }

  async moveToBacklog(entries: readonly { taskId: string; rank: number }[]): Promise<void> {
    await this.prisma.$transaction(
      entries.map((e) =>
        this.prisma.task.update({ where: { id: e.taskId }, data: { sprintId: null, backlogRank: e.rank } }),
      ),
    );
  }

  async topBacklogRank(projectId: string): Promise<number | null> {
    const r = await this.prisma.task.aggregate({
      where: { projectId, sprintId: null, backlogRank: { not: null } },
      _min: { backlogRank: true },
    });
    return r._min.backlogRank;
  }

  async setBacklogRank(taskId: string, rank: number): Promise<void> {
    await this.prisma.task.update({ where: { id: taskId }, data: { backlogRank: rank } });
  }
}
