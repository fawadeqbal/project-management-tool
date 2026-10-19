import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { OnboardingDto } from '@hearth/contracts';
import { createEvent, type Clock } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';
import { OnboardingReadModel } from '../../infrastructure/onboarding.read-model';
import { CompleteOnboardingStepCommand } from './complete-onboarding-step.command';

@CommandHandler(CompleteOnboardingStepCommand)
export class CompleteOnboardingStepHandler implements ICommandHandler<CompleteOnboardingStepCommand, OnboardingDto> {
  constructor(
    private readonly store: OnboardingProgressStore,
    private readonly read: OnboardingReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, step }: CompleteOnboardingStepCommand): Promise<OnboardingDto> {
    if (await this.store.complete(actor.workspaceId, actor.userId, step))
      this.events.publish(
        createEvent('onboarding.step_completed', { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: actor.userId, occurredAt: this.clock.now() }, { step }),
      );
    return this.read.get(actor);
  }
}
