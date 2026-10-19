import { Injectable } from '@nestjs/common';
import { Sprint, type SprintRepository, type SprintStatus } from '@hearth/domain';
import type { Sprint as SprintRow } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Adapter: the Sprint aggregate persisted with Prisma (workspace comes from the project). */
@Injectable()
export class PrismaSprintRepository implements SprintRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workspaceId: string, id: string): Promise<Sprint | null> {
    const row = await this.prisma.sprint.findFirst({ where: { id, project: { workspaceId } } });
    return row ? this.restore(row, workspaceId) : null;
  }

  async findActive(projectId: string): Promise<Sprint | null> {
    const row = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      include: { project: { select: { workspaceId: true } } },
    });
    return row ? this.restore(row, row.project.workspaceId) : null;
  }

  async findNextPlanned(projectId: string, afterNumber: number): Promise<Sprint | null> {
    const row = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'PLANNED', number: { gt: afterNumber } },
      orderBy: { number: 'asc' },
      include: { project: { select: { workspaceId: true } } },
    });
    return row ? this.restore(row, row.project.workspaceId) : null;
  }

  async nextNumber(projectId: string): Promise<number> {
    const last = await this.prisma.sprint.aggregate({ where: { projectId }, _max: { number: true } });
    return (last._max.number ?? 0) + 1;
  }

  async save(sprint: Sprint): Promise<void> {
    const s = sprint.toSnapshot();
    const data = {
      number: s.number,
      name: s.name,
      goal: s.goal,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
      committedPoints: s.committedPoints,
      completedAt: s.completedAt,
    };
    await this.prisma.sprint.upsert({
      where: { id: s.id },
      create: { id: s.id, projectId: s.projectId, ...data },
      update: data,
    });
  }

  private restore(row: SprintRow, workspaceId: string): Sprint {
    return Sprint.restore(row.id, {
      projectId: row.projectId,
      workspaceId,
      number: row.number,
      name: row.name,
      goal: row.goal,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as SprintStatus,
      committedPoints: row.committedPoints,
      completedAt: row.completedAt,
    });
  }
}
