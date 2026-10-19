import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  DashboardQuerySchema,
  ScheduleDashboardSchema,
  UpdateDashboardLayoutSchema,
  type DashboardDto,
  type DashboardQuery,
  type ScheduleDashboardInput,
  type UpdateDashboardLayoutInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { RequireFeature } from '../../../shared/billing/require-feature';
import { GetDashboardQuery } from '../application/queries/get-dashboard.query';
import { SaveDashboardLayoutCommand } from '../application/commands/save-dashboard-layout.command';
import { ScheduleDashboardCommand } from '../application/commands/schedule-dashboard.command';

@Controller('dashboard')
@RequirePermission('reports.view')
export class ReportingController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  dashboard(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQuery,
  ): Promise<DashboardDto> {
    return this.queries.execute(new GetDashboardQuery(actor, query));
  }

  @Post('schedule')
  @RequireFeature('dashboards')
  schedule(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(ScheduleDashboardSchema)) input: ScheduleDashboardInput,
  ) {
    return this.commands.execute(new ScheduleDashboardCommand(actor, input));
  }

  @Patch('layout')
  @RequireFeature('dashboards')
  layout(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(UpdateDashboardLayoutSchema)) input: UpdateDashboardLayoutInput,
  ) {
    return this.commands.execute(new SaveDashboardLayoutCommand(actor, input));
  }
}
