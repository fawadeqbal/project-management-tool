import { Injectable } from '@nestjs/common';
import { startOfDay } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { SprintSnapshotStore } from '../application/sprints.ports';

@Injectable()
export class PrismaSprintSnapshotStore implements SprintSnapshotStore {
  constructor(private readonly prisma: PrismaService) {}

  async activeSprintIds(projectId: string): Promise<string[]> {
    const rows = await this.prisma.sprint.findMany({ where: { projectId, status: 'ACTIVE' }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async statusOf(sprintId: string) {
    const row = await this.prisma.sprint.findUnique({ where: { id: sprintId }, select: { status: true } });
    return row?.status ?? null;
  }

  async upsert(sprintId: string, date: Date, remainingPoints: number, scopePoints: number): Promise<void> {
    const day = startOfDay(date);
    await this.prisma.sprintSnapshot.upsert({
      where: { sprintId_date: { sprintId, date: day } },
      create: { sprintId, date: day, remainingPoints, scopePoints },
      update: { remainingPoints, scopePoints },
    });
  }
}
