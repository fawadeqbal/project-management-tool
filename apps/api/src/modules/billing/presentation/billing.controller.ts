import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CancelPlanSchema,
  ChangePlanSchema,
  PauseBillingSchema,
  type BillingDto,
  type CancelPlanInput,
  type ChangePlanInput,
  type ChangePlanResultDto,
  type FeatureLimitDto,
  type PauseBillingInput,
  type WorkspaceExportDto,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import type { Response } from 'express';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { GetBillingQuery } from '../application/queries/get-billing.query';
import { GetFeatureLimitQuery } from '../application/queries/get-feature-limit.query';
import { ExportWorkspaceQuery } from '../application/queries/export-workspace.query';
import { ChangePlanCommand } from '../application/commands/change-plan.command';
import { PauseBillingCommand } from '../application/commands/pause-billing.command';
import { ResumeBillingCommand } from '../application/commands/resume-billing.command';
import { CancelPlanCommand } from '../application/commands/cancel-plan.command';

/** Billing & plan. Anyone in the workspace (not guests) can see it; only owners change it. */
@Controller('billing')
export class BillingController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequirePermission('members.view')
  billing(@CurrentActor() actor: Actor): Promise<BillingDto> {
    return this.queries.execute(new GetBillingQuery(actor));
  }

  @Get('limits/:feature')
  limit(@CurrentActor() actor: Actor, @Param('feature') feature: string): Promise<FeatureLimitDto> {
    return this.queries.execute(new GetFeatureLimitQuery(actor, feature));
  }

  @Get('export')
  @RequirePermission('workspace.manage')
  async export(
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WorkspaceExportDto> {
    const data: WorkspaceExportDto = await this.queries.execute(new ExportWorkspaceQuery(actor));
    const slug =
      data.workspace.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'workspace';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-export-${data.exportedAt.slice(0, 10)}.json"`,
    );
    return data;
  }

  @Post('plan')
  @HttpCode(200)
  @RequirePermission('billing.manage')
  changePlan(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(ChangePlanSchema)) input: ChangePlanInput,
  ): Promise<ChangePlanResultDto> {
    return this.commands.execute(new ChangePlanCommand(actor, input));
  }

  @Post('pause')
  @HttpCode(200)
  @RequirePermission('billing.manage')
  pause(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(PauseBillingSchema)) input: PauseBillingInput,
  ): Promise<BillingDto> {
    return this.commands.execute(new PauseBillingCommand(actor, input.months));
  }

  @Post('resume')
  @HttpCode(200)
  @RequirePermission('billing.manage')
  resume(@CurrentActor() actor: Actor): Promise<BillingDto> {
    return this.commands.execute(new ResumeBillingCommand(actor));
  }

  @Post('cancel')
  @HttpCode(200)
  @RequirePermission('billing.manage')
  cancel(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CancelPlanSchema)) input: CancelPlanInput,
  ): Promise<BillingDto> {
    return this.commands.execute(new CancelPlanCommand(actor, input.confirm));
  }
}
