import type { OnboardingStepIdDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class CompleteOnboardingStepCommand {
  constructor(
    readonly actor: Actor,
    readonly step: OnboardingStepIdDto,
  ) {}
}
