import { Inject } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import { createEvent, type Clock, type DomainEvent } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventEnvelope } from '../../../../shared/events/domain-event.envelope';
import { DomainEventSubscriber } from '../../../../shared/events/domain-event.subscriber';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';

/** task.created → ticks "Create your first task" for the person who created it. */
@EventsHandler(DomainEventEnvelope)
export class FirstTaskCreatedHandler extends DomainEventSubscriber {
  protected readonly types = ['task.created'];

  constructor(
    private readonly store: OnboardingProgressStore,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super();
  }

  protected async on(event: DomainEvent): Promise<void> {
    if (await this.store.complete(event.workspaceId, event.actorId, 'create-first-task'))
      this.events.publish(
        createEvent(
          'onboarding.step_completed',
          {
            workspaceId: event.workspaceId,
            actorId: event.actorId,
            aggregateId: event.actorId,
            occurredAt: this.clock.now(),
          },
          { step: 'create-first-task' },
        ),
      );
  }
}
