import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApplyTemplateSchema,
  OnboardingStepIdSchema,
  type ApplyTemplateInput,
  type ApplyTemplateResultDto,
  type OnboardingDto,
  type OnboardingStepIdDto,
  type ProjectTemplateDto,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { GetOnboardingQuery } from '../application/queries/get-onboarding.query';
import { ListTemplatesQuery } from '../application/queries/list-templates.query';
import { CompleteOnboardingStepCommand } from '../application/commands/complete-onboarding-step.command';
import { DismissOnboardingCommand } from '../application/commands/dismiss-onboarding.command';
import { ApplyTemplateCommand } from '../application/commands/apply-template.command';

@Controller()
export class OnboardingController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('onboarding')
  onboarding(@CurrentActor() actor: Actor): Promise<OnboardingDto> {
    return this.queries.execute(new GetOnboardingQuery(actor));
  }

  @Post('onboarding/steps/:id/complete')
  @HttpCode(200)
  complete(@CurrentActor() actor: Actor, @Param('id', new ZodValidationPipe(OnboardingStepIdSchema)) step: OnboardingStepIdDto): Promise<OnboardingDto> {
    return this.commands.execute(new CompleteOnboardingStepCommand(actor, step));
  }

  @Post('onboarding/dismiss')
  @HttpCode(200)
  dismiss(@CurrentActor() actor: Actor): Promise<OnboardingDto> {
    return this.commands.execute(new DismissOnboardingCommand(actor));
  }

  @Get('templates')
  templates(): Promise<ProjectTemplateDto[]> {
    return this.queries.execute(new ListTemplatesQuery());
  }

  @Post('templates/:id/apply')
  @RequirePermission('projects.create')
  apply(@CurrentActor() actor: Actor, @Param('id') id: string, @Body(new ZodValidationPipe(ApplyTemplateSchema)) input: ApplyTemplateInput): Promise<ApplyTemplateResultDto> {
    return this.commands.execute(new ApplyTemplateCommand(actor, id, input));
  }
}
