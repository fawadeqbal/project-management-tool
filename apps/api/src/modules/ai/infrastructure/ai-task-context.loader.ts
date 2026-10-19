import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, toDateOnly, type AiTaskContext, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { dateOnly } from '../../../shared/mappers/refs';

export interface LoadedTask {
  id: string;
  key: string;
  projectId: string | null;
  sectionId: string | null;
  description: string | null;
  context: AiTaskContext;
}

/** Reads what a provider may see about a task (the AI context's own read of the task tables). */
@Injectable()
export class AiTaskContextLoader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async load(workspaceId: string, taskId: string): Promise<LoadedTask> {
    const t = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        workspace: { select: { keyPrefix: true } },
        subtasks: { select: { title: true, status: true }, orderBy: { listPosition: 'asc' } },
        blockedBy: { include: { blocker: { select: { number: true, title: true, status: true } } } },
        comments: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });
    if (!t) throw new NotFoundError('Task', taskId);
    const prefix = t.workspace.keyPrefix;
    const key = `${prefix}-${t.number}`;
    return {
      id: t.id,
      key,
      projectId: t.projectId,
      sectionId: t.sectionId,
      description: t.description,
      context: {
        key,
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: dateOnly(t.dueDate),
        today: toDateOnly(this.clock.now()),
        blockedBy: t.blockedBy.map((d) => ({
          key: `${prefix}-${d.blocker.number}`,
          title: d.blocker.title,
          status: d.blocker.status,
        })),
        subtasks: t.subtasks.map((s) => ({ title: s.title, done: s.status === 'DONE' })),
        comments: t.comments.map((c) => ({
          author: c.author.name,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    };
  }
}
