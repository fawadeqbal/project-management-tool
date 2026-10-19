import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY, type Actor, type TaskRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { TASK_RELATIONS, type TaskRelations } from '../ports';
import { loadTask } from '../task-support';
import type { FollowResult } from './follow-task.command';

export class UnfollowTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
  ) {}
}

/** Stop notifications for a task. Idempotent. */
@CommandHandler(UnfollowTaskCommand)
export class UnfollowTaskHandler implements ICommandHandler<UnfollowTaskCommand, FollowResult> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    private readonly access: AccessService,
  ) {}

  async execute({ actor, taskId }: UnfollowTaskCommand): Promise<FollowResult> {
    const task = await loadTask(this.tasks, actor, taskId);
    this.access.assert(actor, 'tasks.view', { projectId: task.projectId });
    await this.relations.unfollow(task.id, actor.userId);
    return { following: false };
  }
}
