import { Injectable } from '@nestjs/common';
import type { Task as TaskRow } from '@prisma/client';
import { NotFoundError, Task, type TaskProps, type TaskRepository } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Prisma adapter for the domain TaskRepository port. Ordering, tags and relations live in TaskRelations. */
@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workspaceId: string, id: string): Promise<Task | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, workspaceId },
      include: { workspace: { select: { keyPrefix: true } } },
    });
    return row ? toAggregate(row, row.workspace.keyPrefix) : null;
  }

  async findByNumber(workspaceId: string, number: number): Promise<Task | null> {
    const row = await this.prisma.task.findUnique({
      where: { workspaceId_number: { workspaceId, number } },
      include: { workspace: { select: { keyPrefix: true } } },
    });
    return row ? toAggregate(row, row.workspace.keyPrefix) : null;
  }

  async nextNumber(workspaceId: string): Promise<{ number: number; keyPrefix: string }> {
    try {
      // A single UPDATE … SET taskSeq = taskSeq + 1 RETURNING — atomic under concurrent creates.
      const ws = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { taskSeq: { increment: 1 } },
        select: { taskSeq: true, keyPrefix: true },
      });
      return { number: ws.taskSeq, keyPrefix: ws.keyPrefix };
    } catch {
      throw new NotFoundError('Workspace', workspaceId);
    }
  }

  async save(task: Task): Promise<void> {
    const { id, key: _key, keyPrefix: _prefix, ...props } = task.toSnapshot();
    const columns = {
      projectId: props.projectId,
      sectionId: props.sectionId,
      parentId: props.parentId,
      sprintId: props.sprintId,
      title: props.title,
      description: props.description,
      status: props.status,
      priority: props.priority,
      assigneeId: props.assigneeId,
      startDate: props.startDate,
      dueDate: props.dueDate,
      estimatePoints: props.estimatePoints,
      estimateHours: props.estimateHours,
      progress: props.progress,
      completedAt: props.completedAt,
      updatedAt: props.updatedAt,
    };
    await this.prisma.task.upsert({
      where: { id },
      create: {
        id,
        workspaceId: props.workspaceId,
        number: props.number,
        creatorId: props.creatorId,
        createdAt: props.createdAt,
        ...columns,
      },
      update: columns,
    });
  }

  async delete(task: Task): Promise<void> {
    await this.prisma.task.deleteMany({ where: { id: task.id, workspaceId: task.workspaceId } });
  }
}

const toAggregate = (row: TaskRow, keyPrefix: string): Task => {
  const props: TaskProps = {
    workspaceId: row.workspaceId,
    keyPrefix,
    number: row.number,
    projectId: row.projectId,
    sectionId: row.sectionId,
    parentId: row.parentId,
    sprintId: row.sprintId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assigneeId,
    creatorId: row.creatorId,
    startDate: row.startDate,
    dueDate: row.dueDate,
    estimatePoints: row.estimatePoints,
    estimateHours: row.estimateHours,
    progress: row.progress,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return Task.restore(row.id, props);
};
