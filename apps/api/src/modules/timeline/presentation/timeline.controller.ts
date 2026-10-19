import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApplyScheduleSchema,
  RescheduleTaskSchema,
  TimelineQuerySchema,
  type ApplyScheduleInput,
  type RescheduleResultDto,
  type RescheduleTaskInput,
  type ScheduleItemInput,
  type TimelineDto,
  type TimelineQuery,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { RequireFeature } from '../../../shared/billing/require-feature';
import { RequirePermission } from '../../../shared/access/require-permission';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { GetTimelineQuery } from '../application/queries/get-timeline.query';
import { RescheduleTaskCommand } from '../application/commands/reschedule-task.handler';
import { ApplyScheduleCommand } from '../application/commands/apply-schedule.handler';

/** Timeline (Gantt): reads stay previewable on every plan; writes need the Pro "timeline" feature. */
@Controller()
export class TimelineController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('projects/:id/timeline')
  timeline(@CurrentActor() actor: Actor, @Param('id') id: string, @Query(new ZodValidationPipe(TimelineQuerySchema)) range: TimelineQuery): Promise<TimelineDto> {
    return this.queries.execute(new GetTimelineQuery(actor, id, range));
  }

  @Post('timeline/tasks/:taskId/reschedule')
  @HttpCode(200)
  @RequirePermission('tasks.edit')
  @RequireFeature('timeline')
  reschedule(
    @CurrentActor() actor: Actor,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(RescheduleTaskSchema)) input: RescheduleTaskInput,
  ): Promise<RescheduleResultDto> {
    return this.commands.execute(new RescheduleTaskCommand(actor, taskId, input));
  }

  @Post('timeline/schedule')
  @HttpCode(200)
  @RequirePermission('tasks.edit')
  @RequireFeature('timeline')
  apply(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(ApplyScheduleSchema)) input: ApplyScheduleInput): Promise<{ updated: ScheduleItemInput[] }> {
    return this.commands.execute(new ApplyScheduleCommand(actor, input));
  }
}
