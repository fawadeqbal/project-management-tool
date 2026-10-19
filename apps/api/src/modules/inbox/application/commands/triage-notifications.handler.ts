import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import type { InboxTriageResultDto } from '@hearth/contracts';
import { NotFoundError, ValidationError, createEvent, snoozeUntil, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TriageNotificationsCommand } from './triage-notifications.command';

/**
 * Inbox triage. Only the recipient can touch a notification; every action is reversible
 * (archive ↔ unarchive, read ↔ unread, snooze ↔ unsnooze; snoozed items also return on their own).
 */
@CommandHandler(TriageNotificationsCommand)
export class TriageNotificationsHandler implements ICommandHandler<TriageNotificationsCommand, InboxTriageResultDto> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, ids, action }: TriageNotificationsCommand): Promise<InboxTriageResultDto> {
    const now = this.clock.now();
    let data: Prisma.NotificationUpdateManyMutationInput;
    let snoozedUntil: Date | undefined;
    switch (action.kind) {
      case 'read':
        data = { readAt: now };
        break;
      case 'unread':
        data = { readAt: null };
        break;
      case 'archive':
        data = { archivedAt: now, readAt: now };
        break;
      case 'unarchive':
        data = { archivedAt: null };
        break;
      case 'unsnooze':
        data = { snoozedUntil: null };
        break;
      case 'snooze': {
        snoozedUntil = action.preset ? snoozeUntil(action.preset, now) : new Date(action.until!);
        if (snoozedUntil.getTime() <= now.getTime()) throw new ValidationError('inbox.snooze_past', 'Pick a time in the future to snooze until.');
        data = { snoozedUntil };
        break;
      }
    }
    const where: Prisma.NotificationWhereInput = { id: { in: ids }, workspaceId: actor.workspaceId, recipientId: actor.userId };
    // "read" on an already-read item keeps its original read time.
    if (action.kind === 'read') where.readAt = null;
    const { count } = await this.prisma.notification.updateMany({ where, data });
    if (count === 0 && ids.length === 1 && action.kind !== 'read') {
      const exists = await this.prisma.notification.count({ where: { id: ids[0], workspaceId: actor.workspaceId, recipientId: actor.userId } });
      if (!exists) throw new NotFoundError('Notification', ids[0]!);
    }
    // Lets the user's other tabs and devices refresh their counts.
    this.events.publish(
      createEvent('notification.updated', { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: ids[0]!, occurredAt: now }, {
        recipientId: actor.userId,
        ids,
        action: action.kind,
      }),
    );
    return { updated: count, ...(snoozedUntil ? { snoozedUntil: snoozedUntil.toISOString() } : {}) };
  }
}
