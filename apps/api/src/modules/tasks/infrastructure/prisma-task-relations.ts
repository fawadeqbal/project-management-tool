import { Injectable } from '@nestjs/common';
import type { DependencyEdge, TaskStatus } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { TaskOrdering, TaskRelations } from '../application/ports';

/** Prisma adapter for the TaskRelations port (columns and join tables around the aggregate). */
@Injectable()
export class PrismaTaskRelations implements TaskRelations {
  constructor(private readonly prisma: PrismaService) {}

  async lastPositions(
    workspaceId: string,
    scope: { projectId: string | null; status: TaskStatus; parentId: string | null },
  ): Promise<{ board: number | null; list: number | null }> {
    const [board, list] = await Promise.all([
      this.prisma.task.aggregate({ where: { workspaceId, projectId: scope.projectId, status: scope.status, parentId: null }, _max: { boardPosition: true } }),
      this.prisma.task.aggregate({ where: { workspaceId, projectId: scope.projectId, parentId: scope.parentId }, _max: { listPosition: true } }),
    ]);
    return { board: board._max.boardPosition, list: list._max.listPosition };
  }

  async positionsOf(workspaceId: string, ids: readonly string[]): Promise<Map<string, TaskOrdering>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.task.findMany({
      where: { workspaceId, id: { in: [...ids] } },
      select: { id: true, boardPosition: true, listPosition: true },
    });
    return new Map(rows.map((r) => [r.id, { boardPosition: r.boardPosition, listPosition: r.listPosition }]));
  }

  async setOrdering(taskId: string, ordering: Partial<TaskOrdering>): Promise<void> {
    if (ordering.boardPosition === undefined && ordering.listPosition === undefined) return;
    await this.prisma.task.update({ where: { id: taskId }, data: ordering });
  }

  async setEpic(taskId: string, epic: string | null): Promise<void> {
    await this.prisma.task.update({ where: { id: taskId }, data: { epic: epic?.trim() ? epic.trim() : null } });
  }

  async replaceTags(taskId: string, tagIds: readonly string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.taskTag.deleteMany({ where: { taskId } }),
      this.prisma.taskTag.createMany({ data: [...new Set(tagIds)].map((tagId) => ({ taskId, tagId })), skipDuplicates: true }),
    ]);
  }

  async follow(taskId: string, userIds: readonly string[]): Promise<void> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    await this.prisma.taskFollower.createMany({ data: ids.map((userId) => ({ taskId, userId })), skipDuplicates: true });
  }

  async unfollow(taskId: string, userId: string): Promise<void> {
    await this.prisma.taskFollower.deleteMany({ where: { taskId, userId } });
  }

  async subtaskStatuses(parentId: string): Promise<TaskStatus[]> {
    const rows = await this.prisma.task.findMany({ where: { parentId }, select: { status: true } });
    return rows.map((r) => r.status);
  }

  async dependencyEdges(workspaceId: string): Promise<DependencyEdge[]> {
    return this.prisma.taskDependency.findMany({
      where: { blocker: { workspaceId }, blocked: { workspaceId } },
      select: { blockerId: true, blockedId: true },
    });
  }

  async addDependency(edge: DependencyEdge): Promise<void> {
    await this.prisma.taskDependency.createMany({ data: [edge], skipDuplicates: true });
  }

  async removeDependency(edge: DependencyEdge): Promise<boolean> {
    const { count } = await this.prisma.taskDependency.deleteMany({ where: edge });
    return count > 0;
  }

  async findComment(taskId: string, commentId: string): Promise<{ id: string; authorId: string } | null> {
    return this.prisma.comment.findFirst({ where: { id: commentId, taskId }, select: { id: true, authorId: true } });
  }

  async createComment(input: { taskId: string; authorId: string; body: string; parentId: string | null; createdAt: Date }): Promise<{ id: string }> {
    return this.prisma.comment.create({ data: input, select: { id: true } });
  }
}
