import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { OnboardingDto } from '@hearth/contracts';
import type { Clock } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';
import { OnboardingReadModel } from '../../infrastructure/onboarding.read-model';
import { DismissOnboardingCommand } from './dismiss-onboarding.command';

@CommandHandler(DismissOnboardingCommand)
export class DismissOnboardingHandler implements ICommandHandler<DismissOnboardingCommand, OnboardingDto> {
  constructor(
    private readonly store: OnboardingProgressStore,
    private readonly read: OnboardingReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor }: DismissOnboardingCommand): Promise<OnboardingDto> {
    await this.store.dismiss(actor.workspaceId, actor.userId, this.clock.now());
    return this.read.get(actor);
  }
}
