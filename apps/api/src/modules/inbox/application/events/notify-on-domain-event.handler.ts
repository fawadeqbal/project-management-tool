import { Inject } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import { createEvent, notificationsFor, type DomainEvent } from '@hearth/domain';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import { DomainEventSubscriber } from '../../../../shared/events/domain-event.subscriber';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { NOTIFICATION_GATEWAY, type NotificationGateway } from '../ports';

/**
 * Observer: turns task, comment and approval events into inbox notifications using the domain
 * `notificationsFor` policy, then announces `notification.created` so open browsers refresh
 * their counts live.
 */
@EventsHandler(DomainEventEnvelope)
export class NotifyOnDomainEventHandler extends DomainEventSubscriber {
  protected readonly types = ['task.assigned', 'task.status_changed', 'comment.created', 'approval.requested', 'approval.decided'];

  constructor(
    @Inject(NOTIFICATION_GATEWAY) private readonly gateway: NotificationGateway,
    private readonly events: DomainEventPublisher,
  ) {
    super();
  }

  protected async on(event: DomainEvent): Promise<void> {
    const ctx = await this.gateway.contextFor(event);
    const drafts = notificationsFor(event, ctx);
    if (!drafts.length) return;
    const fallback = String((event.payload as Record<string, unknown>)['title'] ?? '');
    const created = await this.gateway.createMany(
      drafts.map((d) => ({
        ...d,
        workspaceId: event.workspaceId,
        actorId: event.actorId,
        context: ctx.context ?? fallback,
        createdAt: event.occurredAt,
      })),
    );
    this.events.publish(
      ...created.map((n) =>
        createEvent(
          'notification.created',
          { workspaceId: event.workspaceId, actorId: event.actorId, aggregateId: n.id, occurredAt: event.occurredAt },
          { recipientId: n.recipientId, type: n.type, taskId: n.taskId, cause: event.type },
        ),
      ),
    );
  }
}
