import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  FavoriteStore,
  MilestoneRecord,
  MilestoneStore,
  TeamDirectory,
} from '../application/projects.ports';

@Injectable()
export class PrismaFavoriteStore implements FavoriteStore {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, projectId: string): Promise<void> {
    const last = await this.prisma.favorite.aggregate({ where: { userId }, _max: { position: true } });
    await this.prisma.favorite.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, position: (last._max.position ?? -1) + 1 },
      update: {},
    });
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, projectId } });
  }
}

@Injectable()
export class PrismaMilestoneStore implements MilestoneStore {
  constructor(private readonly prisma: PrismaService) {}

  nextId(): string {
    return `ms_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }

  async findById(workspaceId: string, id: string): Promise<MilestoneRecord | null> {
    const m = await this.prisma.milestone.findFirst({
      where: { id, project: { workspaceId, archivedAt: null } },
      include: { dependsOn: { select: { taskId: true } } },
    });
    return m
      ? {
          id: m.id,
          projectId: m.projectId,
          name: m.name,
          date: m.date,
          doneAt: m.doneAt,
          dependsOnTaskIds: m.dependsOn.map((d) => d.taskId),
        }
      : null;
  }

  async save(m: MilestoneRecord): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.milestone.upsert({
        where: { id: m.id },
        create: { id: m.id, projectId: m.projectId, name: m.name, date: m.date, doneAt: m.doneAt },
        update: { name: m.name, date: m.date, doneAt: m.doneAt },
      }),
      this.prisma.milestoneDependency.deleteMany({
        where: { milestoneId: m.id, taskId: { notIn: m.dependsOnTaskIds } },
      }),
      this.prisma.milestoneDependency.createMany({
        data: m.dependsOnTaskIds.map((taskId) => ({ milestoneId: m.id, taskId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.milestone.deleteMany({ where: { id } });
  }

  async tasksInProject(projectId: string, taskIds: string[]): Promise<string[]> {
    if (!taskIds.length) return [];
    const rows = await this.prisma.task.findMany({
      where: { projectId, id: { in: taskIds } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}

@Injectable()
export class PrismaTeamDirectory implements TeamDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async exists(workspaceId: string, teamId: string): Promise<boolean> {
    return (await this.prisma.team.count({ where: { id: teamId, workspaceId } })) > 0;
  }
}
