import { Module } from '@nestjs/common';
import { OnboardingProgressStore } from './infrastructure/onboarding-progress.store';
import { OnboardingReadModel } from './infrastructure/onboarding.read-model';
import { TemplateProjectWriter } from './infrastructure/template-project.writer';
import { GetOnboardingHandler } from './application/queries/get-onboarding.handler';
import { ListTemplatesHandler } from './application/queries/list-templates.handler';
import { CompleteOnboardingStepHandler } from './application/commands/complete-onboarding-step.handler';
import { DismissOnboardingHandler } from './application/commands/dismiss-onboarding.handler';
import { ApplyTemplateHandler } from './application/commands/apply-template.handler';
import { FirstTaskCreatedHandler } from './application/events/first-task-created.handler';
import { TeammatesJoinedHandler } from './application/events/teammates-joined.handler';
import { OnboardingController } from './presentation/onboarding.controller';

/** Onboarding bounded context: the getting-started checklist and project templates. */
@Module({
  controllers: [OnboardingController],
  providers: [
    OnboardingProgressStore,
    OnboardingReadModel,
    TemplateProjectWriter,
    GetOnboardingHandler,
    ListTemplatesHandler,
    CompleteOnboardingStepHandler,
    DismissOnboardingHandler,
    ApplyTemplateHandler,
    FirstTaskCreatedHandler,
    TeammatesJoinedHandler,
  ],
})
export class OnboardingModule {}
