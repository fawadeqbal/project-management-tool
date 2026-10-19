import { Body, Controller, Get, Param, Patch, Post, Delete } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  AddSprintTaskSchema,
  CompleteSprintSchema,
  CreateSprintSchema,
  RankBacklogSchema,
  UpdateSprintSchema,
  type AddSprintTaskInput,
  type CompleteSprintInput,
  type CreateSprintInput,
  type RankBacklogInput,
  type RetrospectiveDto,
  type SprintDetailDto,
  type SprintSummaryDto,
  type SprintTaskDto,
  type UpdateSprintInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { RequireFeature } from '../../../shared/billing/require-feature';
import { ListSprintsQuery } from '../application/queries/list-sprints.query';
import { GetSprintQuery } from '../application/queries/get-sprint.query';
import { GetBacklogQuery } from '../application/queries/get-backlog.query';
import { PlanSprintCommand } from '../application/commands/plan-sprint.command';
import { UpdateSprintCommand } from '../application/commands/update-sprint.command';
import { StartSprintCommand } from '../application/commands/start-sprint.command';
import { CompleteSprintCommand } from '../application/commands/complete-sprint.command';
import { AddSprintTaskCommand } from '../application/commands/add-sprint-task.command';
import { RemoveSprintTaskCommand } from '../application/commands/remove-sprint-task.command';
import { RankBacklogCommand } from '../application/commands/rank-backlog.command';

/** Sprints (BUSINESS): reads stay previewable on every plan; writes need the sprints feature. */
@Controller()
export class SprintsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('projects/:projectId/sprints')
  list(@CurrentActor() actor: Actor, @Param('projectId') projectId: string): Promise<SprintSummaryDto[]> {
    return this.queries.execute(new ListSprintsQuery(actor, projectId));
  }

  @Get('projects/:projectId/backlog')
  backlog(@CurrentActor() actor: Actor, @Param('projectId') projectId: string): Promise<SprintTaskDto[]> {
    return this.queries.execute(new GetBacklogQuery(actor, projectId));
  }

  @Get('sprints/:id')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<SprintDetailDto> {
    return this.queries.execute(new GetSprintQuery(actor, id));
  }

  @Post('projects/:projectId/sprints')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  plan(
    @CurrentActor() actor: Actor,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateSprintSchema)) input: CreateSprintInput,
  ): Promise<SprintSummaryDto> {
    return this.commands.execute(new PlanSprintCommand(actor, projectId, input));
  }

  @Post('projects/:projectId/backlog/rank')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  rank(
    @CurrentActor() actor: Actor,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(RankBacklogSchema)) input: RankBacklogInput,
  ) {
    return this.commands.execute(new RankBacklogCommand(actor, projectId, input));
  }

  @Patch('sprints/:id')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSprintSchema)) input: UpdateSprintInput,
  ): Promise<SprintSummaryDto> {
    return this.commands.execute(new UpdateSprintCommand(actor, id, input));
  }

  @Post('sprints/:id/start')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  start(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<SprintSummaryDto> {
    return this.commands.execute(new StartSprintCommand(actor, id));
  }

  @Post('sprints/:id/complete')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  complete(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteSprintSchema)) input: CompleteSprintInput,
  ): Promise<RetrospectiveDto> {
    return this.commands.execute(new CompleteSprintCommand(actor, id, input.moveUnfinishedTo));
  }

  @Post('sprints/:id/tasks')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  addTask(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddSprintTaskSchema)) input: AddSprintTaskInput,
  ): Promise<SprintSummaryDto> {
    return this.commands.execute(new AddSprintTaskCommand(actor, id, input.taskId));
  }

  @Delete('sprints/:id/tasks/:taskId')
  @RequirePermission('sprints.manage')
  @RequireFeature('sprints')
  removeTask(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ): Promise<SprintSummaryDto> {
    return this.commands.execute(new RemoveSprintTaskCommand(actor, id, taskId));
  }
}
