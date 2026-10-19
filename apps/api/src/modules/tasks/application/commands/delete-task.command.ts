import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY, type Actor, type Clock, type TaskRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TASK_RELATIONS, type TaskRelations } from '../ports';
import { loadTask } from '../task-support';
import { rollUpProgress } from '../progress-rollup';

export class DeleteTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
  ) {}
}

/** Deletes a task (subtasks, comments and links cascade). Publishes `task.deleted` first so listeners still see the row. */
@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, void> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute({ actor, taskId }: DeleteTaskCommand): Promise<void> {
    const task = await loadTask(this.tasks, actor, taskId);
    const { projectId, parentId } = task.toSnapshot();
    this.access.assert(actor, 'tasks.delete', { projectId });
    const now = this.clock.now();
    task.markDeleted(actor.userId, now);
    this.publisher.publishFrom(task);
    await this.tasks.delete(task);

    // Removing a subtask changes its parent's roll-up.
    if (parentId) {
      const parent = await this.tasks.findById(actor.workspaceId, parentId);
      const progress = parent ? rollUpProgress(await this.relations.subtaskStatuses(parentId)) : null;
      if (parent && progress !== null && progress !== parent.toSnapshot().progress) {
        parent.setProgress(progress, actor.userId, now);
        await this.tasks.save(parent);
        this.publisher.publishFrom(parent);
      }
    }
  }
}
