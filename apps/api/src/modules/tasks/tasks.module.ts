import { Module } from '@nestjs/common';
import { TASK_REPOSITORY } from '@hearth/domain';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { PrismaTaskDirectory } from './infrastructure/prisma-task-directory';
import { PrismaTaskRelations } from './infrastructure/prisma-task-relations';
import { TaskReadModel } from './infrastructure/task.read-model';
import { TASK_DIRECTORY, TASK_RELATIONS } from './application/ports';
import { TaskCreationService } from './application/task-creation.service';
import { CreateTaskHandler } from './application/commands/create-task.command';
import { QuickAddTaskHandler } from './application/commands/quick-add-task.command';
import { UpdateTaskHandler } from './application/commands/update-task.command';
import { MoveTaskHandler } from './application/commands/move-task.command';
import { DeleteTaskHandler } from './application/commands/delete-task.command';
import { AddCommentHandler } from './application/commands/add-comment.command';
import { AddDependencyHandler } from './application/commands/add-dependency.command';
import { RemoveDependencyHandler } from './application/commands/remove-dependency.command';
import { FollowTaskHandler } from './application/commands/follow-task.command';
import { UnfollowTaskHandler } from './application/commands/unfollow-task.command';
import { ListTasksHandler } from './application/queries/list-tasks.query';
import { GetTaskHandler } from './application/queries/get-task.query';
import { GetTaskByKeyHandler } from './application/queries/get-task-by-key.query';
import { TasksController } from './presentation/tasks.controller';

const COMMAND_HANDLERS = [
  CreateTaskHandler,
  QuickAddTaskHandler,
  UpdateTaskHandler,
  MoveTaskHandler,
  DeleteTaskHandler,
  AddCommentHandler,
  AddDependencyHandler,
  RemoveDependencyHandler,
  FollowTaskHandler,
  UnfollowTaskHandler,
];
const QUERY_HANDLERS = [ListTasksHandler, GetTaskHandler, GetTaskByKeyHandler];

/**
 * Tasks bounded context: the Task aggregate (via the TASK_REPOSITORY port), list/detail read
 * models, quick add, comments, dependencies and followers. Other contexts reuse TaskReadModel
 * for the TaskDto shape and TASK_REPOSITORY to change tasks through the aggregate.
 */
@Module({
  controllers: [TasksController],
  providers: [
    { provide: TASK_REPOSITORY, useClass: PrismaTaskRepository },
    { provide: TASK_DIRECTORY, useClass: PrismaTaskDirectory },
    { provide: TASK_RELATIONS, useClass: PrismaTaskRelations },
    TaskReadModel,
    TaskCreationService,
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
  ],
  exports: [TaskReadModel, TASK_REPOSITORY],
})
export class TasksModule {}
