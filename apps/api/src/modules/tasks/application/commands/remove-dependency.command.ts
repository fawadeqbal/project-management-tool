import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TaskDetailDto } from '@hearth/contracts';
import { NotFoundError, TASK_REPOSITORY, type Actor, type Clock, type TaskRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TASK_RELATIONS, type TaskRelations } from '../ports';
import { loadTask, taskUpdatedEvent } from '../task-support';

export class RemoveDependencyCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly blockerId: string,
  ) {}
}

@CommandHandler(RemoveDependencyCommand)
export class RemoveDependencyHandler implements ICommandHandler<RemoveDependencyCommand, TaskDetailDto> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, taskId, blockerId }: RemoveDependencyCommand): Promise<TaskDetailDto> {
    const blocked = await loadTask(this.tasks, actor, taskId);
    this.access.assert(actor, 'tasks.edit', { projectId: blocked.projectId });
    const removed = await this.relations.removeDependency({ blockerId, blockedId: blocked.id });
    if (!removed) throw new NotFoundError('Dependency', blockerId);

    const now = this.clock.now();
    const blocker = await this.tasks.findById(actor.workspaceId, blockerId);
    this.publisher.publish(
      taskUpdatedEvent(blocked, ['dependencies'], actor.userId, now),
      ...(blocker ? [taskUpdatedEvent(blocker, ['dependencies'], actor.userId, now)] : []),
    );
    return this.read.detail(actor, blocked.id);
  }
}
