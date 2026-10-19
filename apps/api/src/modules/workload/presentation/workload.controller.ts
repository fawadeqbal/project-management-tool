import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateTimeOffSchema,
  TimeOffQuerySchema,
  UpdateCapacitySchema,
  WorkloadQuerySchema,
  type CapacityDto,
  type CreateTimeOffInput,
  type TimeOffDto,
  type TimeOffQuery,
  type UpdateCapacityInput,
  type WorkloadDto,
  type WorkloadQuery,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { RequireFeature } from '../../../shared/billing/require-feature';
import { GetWorkloadQuery } from '../application/queries/get-workload.query';
import { ListTimeOffQuery } from '../application/queries/list-time-off.query';
import { CreateTimeOffCommand } from '../application/commands/create-time-off.command';
import { DeleteTimeOffCommand } from '../application/commands/delete-time-off.command';
import { UpdateCapacityCommand } from '../application/commands/update-capacity.command';

/** Workload (PRO): reads stay previewable on every plan; writes need the workload feature. */
@Controller()
export class WorkloadController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('workload')
  @RequirePermission('members.view')
  workload(@CurrentActor() actor: Actor, @Query(new ZodValidationPipe(WorkloadQuerySchema)) query: WorkloadQuery): Promise<WorkloadDto> {
    return this.queries.execute(new GetWorkloadQuery(actor, query));
  }

  @Get('time-off')
  @RequirePermission('members.view')
  timeOff(@CurrentActor() actor: Actor, @Query(new ZodValidationPipe(TimeOffQuerySchema)) query: TimeOffQuery): Promise<TimeOffDto[]> {
    return this.queries.execute(new ListTimeOffQuery(actor, query));
  }

  @Post('time-off')
  @RequireFeature('workload')
  addTimeOff(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(CreateTimeOffSchema)) input: CreateTimeOffInput): Promise<TimeOffDto> {
    return this.commands.execute(new CreateTimeOffCommand(actor, input));
  }

  @Delete('time-off/:id')
  @HttpCode(204)
  @RequireFeature('workload')
  removeTimeOff(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    return this.commands.execute(new DeleteTimeOffCommand(actor, id));
  }

  @Patch('members/:userId/capacity')
  @RequirePermission('members.manage')
  @RequireFeature('workload')
  capacity(
    @CurrentActor() actor: Actor,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(UpdateCapacitySchema)) input: UpdateCapacityInput,
  ): Promise<CapacityDto> {
    return this.commands.execute(new UpdateCapacityCommand(actor, userId, input.hoursPerDay));
  }
}
