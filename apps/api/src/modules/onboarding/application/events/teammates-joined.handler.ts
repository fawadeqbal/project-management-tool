import { Inject } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import { createEvent, type Clock, type DomainEvent } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import { DomainEventSubscriber } from '../../../../shared/events/domain-event.subscriber';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';

export const TEAMMATES_GOAL = 2;

/** member.joined → when the inviter's second invite is accepted, tick "Invite 2 teammates". */
@EventsHandler(DomainEventEnvelope)
export class TeammatesJoinedHandler extends DomainEventSubscriber {
  protected readonly types = ['member.joined'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: OnboardingProgressStore,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super();
  }

  protected async on(event: DomainEvent): Promise<void> {
    const inviterId = (event.payload as { invitedById?: string }).invitedById;
    if (!inviterId) return;
    const accepted = await this.prisma.invite.count({
      where: { workspaceId: event.workspaceId, invitedById: inviterId, status: 'ACCEPTED' },
    });
    if (accepted < TEAMMATES_GOAL) return;
    if (await this.store.complete(event.workspaceId, inviterId, 'invite-teammates'))
      this.events.publish(
        createEvent(
          'onboarding.step_completed',
          {
            workspaceId: event.workspaceId,
            actorId: inviterId,
            aggregateId: inviterId,
            occurredAt: this.clock.now(),
          },
          { step: 'invite-teammates' },
        ),
      );
  }
}
