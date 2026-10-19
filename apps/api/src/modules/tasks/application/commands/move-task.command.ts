import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { MoveTaskInput, TaskDto } from '@hearth/contracts';
import {
  NotFoundError,
  positionBetween,
  TASK_REPOSITORY,
  type Actor,
  type Clock,
  type TaskRepository,
} from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TASK_RELATIONS, type TaskRelations } from '../ports';
import { loadTask, taskUpdatedEvent } from '../task-support';
import { updateParentProgress } from '../progress-rollup';

export class MoveTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly input: MoveTaskInput,
  ) {}
}

/**
 * Board drag-and-drop / list reordering. `beforeId` is the card that ends up directly above
 * the moved task and `afterId` the one directly below (either may be absent at the column
 * edges); the new position is the midpoint (fractional ordering — one row written).
 */
@CommandHandler(MoveTaskCommand)
export class MoveTaskHandler implements ICommandHandler<MoveTaskCommand, TaskDto> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, taskId, input }: MoveTaskCommand): Promise<TaskDto> {
    const task = await loadTask(this.tasks, actor, taskId);
    const before = task.toSnapshot();
    this.access.assert(actor, 'tasks.edit', { projectId: before.projectId });
    const now = this.clock.now();

    if (input.status) task.changeStatus(input.status, actor.userId, now);

    const neighbourIds = [input.beforeId, input.afterId].filter((id): id is string => !!id && id !== task.id);
    const positions = await this.relations.positionsOf(actor.workspaceId, neighbourIds);
    for (const id of neighbourIds) if (!positions.has(id)) throw new NotFoundError('Task', id);

    const field = input.ordering === 'list' ? 'listPosition' : 'boardPosition';
    const above = input.beforeId ? positions.get(input.beforeId)?.[field] : undefined;
    const below = input.afterId ? positions.get(input.afterId)?.[field] : undefined;
    const reordered = above !== undefined || below !== undefined;
    let position: number | undefined;
    if (reordered) position = positionBetween(above ?? null, below ?? null);
    else if (input.status && input.status !== before.status && field === 'boardPosition') {
      // Dropped into a column without neighbours: append at the end of that column.
      const last = await this.relations.lastPositions(actor.workspaceId, {
        projectId: before.projectId,
        status: input.status,
        parentId: before.parentId,
      });
      position = positionBetween(last.board, null);
    }

    await this.tasks.save(task);
    if (position !== undefined) await this.relations.setOrdering(task.id, { [field]: position });

    const parent =
      task.toSnapshot().status !== before.status
        ? await updateParentProgress(
            { tasks: this.tasks, relations: this.relations },
            actor,
            before.parentId,
            now,
          )
        : null;
    this.publisher.publishFrom(task);
    if (position !== undefined)
      this.publisher.publish(taskUpdatedEvent(task, ['position'], actor.userId, now));
    if (parent) this.publisher.publishFrom(parent);
    return this.read.get(actor.workspaceId, task.id);
  }
}
