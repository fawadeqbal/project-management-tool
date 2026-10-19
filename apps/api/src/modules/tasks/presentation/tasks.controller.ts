import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  AddDependencySchema,
  CreateCommentSchema,
  CreateTaskSchema,
  ListTasksQuerySchema,
  MoveTaskSchema,
  QuickAddTaskSchema,
  UpdateTaskSchema,
  type AddDependencyInput,
  type CommentDto,
  type CreateCommentInput,
  type CreateTaskInput,
  type ListTasksQuery as ListTasksParams,
  type MoveTaskInput,
  type QuickAddTaskInput,
  type TaskDetailDto,
  type TaskDto,
  type UpdateTaskInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { QueryBooleansPipe } from './query-booleans.pipe';
import { ListTasksQuery } from '../application/queries/list-tasks.query';
import { GetTaskQuery } from '../application/queries/get-task.query';
import { GetTaskByKeyQuery } from '../application/queries/get-task-by-key.query';
import { CreateTaskCommand } from '../application/commands/create-task.command';
import { QuickAddTaskCommand } from '../application/commands/quick-add-task.command';
import { UpdateTaskCommand } from '../application/commands/update-task.command';
import { MoveTaskCommand } from '../application/commands/move-task.command';
import { DeleteTaskCommand } from '../application/commands/delete-task.command';
import { AddCommentCommand } from '../application/commands/add-comment.command';
import { AddDependencyCommand } from '../application/commands/add-dependency.command';
import { RemoveDependencyCommand } from '../application/commands/remove-dependency.command';
import { FollowTaskCommand, type FollowResult } from '../application/commands/follow-task.command';
import { UnfollowTaskCommand } from '../application/commands/unfollow-task.command';

/**
 * Thin HTTP adapter for TASK_ROUTES: validate with the contract schema → dispatch → DTO.
 * Role-level permissions are declared here; project-level (guest) checks happen in handlers.
 */
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequirePermission('tasks.view')
  list(
    @CurrentActor() actor: Actor,
    @Query(new QueryBooleansPipe(), new ZodValidationPipe(ListTasksQuerySchema)) query: ListTasksParams,
  ): Promise<TaskDto[]> {
    return this.queries.execute(new ListTasksQuery(actor, query));
  }

  @Post()
  @RequirePermission('tasks.create')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateTaskSchema)) input: CreateTaskInput,
  ): Promise<TaskDetailDto> {
    return this.commands.execute(new CreateTaskCommand(actor, input));
  }

  @Post('quick-add')
  @RequirePermission('tasks.create')
  quickAdd(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(QuickAddTaskSchema)) input: QuickAddTaskInput,
  ): Promise<TaskDto> {
    return this.commands.execute(new QuickAddTaskCommand(actor, input));
  }

  @Get('key/:key')
  @RequirePermission('tasks.view')
  byKey(@CurrentActor() actor: Actor, @Param('key') key: string): Promise<TaskDetailDto> {
    return this.queries.execute(new GetTaskByKeyQuery(actor, key));
  }

  @Get(':id')
  @RequirePermission('tasks.view')
  get(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<TaskDetailDto> {
    return this.queries.execute(new GetTaskQuery(actor, id));
  }

  @Patch(':id')
  @RequirePermission('tasks.edit')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTaskSchema)) input: UpdateTaskInput,
  ): Promise<TaskDetailDto> {
    return this.commands.execute(new UpdateTaskCommand(actor, id, input));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tasks.delete')
  async remove(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.commands.execute(new DeleteTaskCommand(actor, id));
  }

  @Post(':id/move')
  @HttpCode(200)
  @RequirePermission('tasks.edit')
  move(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MoveTaskSchema)) input: MoveTaskInput,
  ): Promise<TaskDto> {
    return this.commands.execute(new MoveTaskCommand(actor, id, input));
  }

  @Post(':id/comments')
  @RequirePermission('comments.create')
  comment(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) input: CreateCommentInput,
  ): Promise<CommentDto> {
    return this.commands.execute(new AddCommentCommand(actor, id, input));
  }

  @Post(':id/dependencies')
  @RequirePermission('tasks.edit')
  addDependency(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddDependencySchema)) input: AddDependencyInput,
  ): Promise<TaskDetailDto> {
    return this.commands.execute(new AddDependencyCommand(actor, id, input.blockerId));
  }

  @Delete(':id/dependencies/:blockerId')
  @RequirePermission('tasks.edit')
  removeDependency(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('blockerId') blockerId: string,
  ): Promise<TaskDetailDto> {
    return this.commands.execute(new RemoveDependencyCommand(actor, id, blockerId));
  }

  @Put(':id/follow')
  @RequirePermission('tasks.view')
  follow(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<FollowResult> {
    return this.commands.execute(new FollowTaskCommand(actor, id));
  }

  /** Alias of PUT — the web client's facade currently POSTs to follow. */
  @Post(':id/follow')
  @HttpCode(200)
  @RequirePermission('tasks.view')
  followAlias(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<FollowResult> {
    return this.follow(actor, id);
  }

  @Delete(':id/follow')
  @RequirePermission('tasks.view')
  unfollow(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<FollowResult> {
    return this.commands.execute(new UnfollowTaskCommand(actor, id));
  }
}
