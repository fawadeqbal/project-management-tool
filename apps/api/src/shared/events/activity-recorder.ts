import { EventsHandler } from '@nestjs/cqrs';
import type { DomainEvent } from '@hearth/domain';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventEnvelope } from './domain-event.envelope';
import { DomainEventSubscriber } from './domain-event.subscriber';

/** Writes the task activity log (the "Activity" tab) from task and comment events. */
@EventsHandler(DomainEventEnvelope)
export class ActivityRecorder extends DomainEventSubscriber {
  protected readonly types = ['task.', 'comment.created', 'approval.'];

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected async on(event: DomainEvent): Promise<void> {
    if (event.type === 'task.deleted') return; // the row cascades away with the task
    const payload = event.payload as Record<string, unknown>;
    const taskId = event.type.startsWith('task.') ? event.aggregateId : (payload['taskId'] as string | undefined);
    if (!taskId) return;
    const exists = await this.prisma.task.count({ where: { id: taskId } });
    if (!exists) return;
    await this.prisma.activity.create({
      data: {
        workspaceId: event.workspaceId,
        taskId,
        actorId: event.actorId,
        type: event.type,
        payload: payload as Prisma.InputJsonValue,
        createdAt: event.occurredAt,
      },
    });
  }
}
