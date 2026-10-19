import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TaskDetailDto } from '@hearth/contracts';
import { DependencyGraph, TASK_REPOSITORY, type Actor, type Clock, type TaskRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TASK_RELATIONS, type TaskRelations } from '../ports';
import { loadTask, taskUpdatedEvent } from '../task-support';

export class AddDependencyCommand {
  constructor(
    readonly actor: Actor,
    /** The blocked task. */
    readonly taskId: string,
    readonly blockerId: string,
  ) {}
}

/** "Blocked by": blocker → task. The DependencyGraph domain service rejects cycles (409). */
@CommandHandler(AddDependencyCommand)
export class AddDependencyHandler implements ICommandHandler<AddDependencyCommand, TaskDetailDto> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TASK_RELATIONS) private readonly relations: TaskRelations,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly publisher: DomainEventPublisher,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, taskId, blockerId }: AddDependencyCommand): Promise<TaskDetailDto> {
    const blocked = await loadTask(this.tasks, actor, taskId);
    const blocker = await loadTask(this.tasks, actor, blockerId);
    this.access.assert(actor, 'tasks.edit', { projectId: blocked.projectId });
    this.access.assert(actor, 'tasks.view', { projectId: blocker.projectId });

    // Cycles can cross projects, so the graph holds every edge in the workspace.
    const graph = new DependencyGraph(await this.relations.dependencyEdges(actor.workspaceId));
    graph.assertCanLink(blocker.id, blocked.id);
    await this.relations.addDependency({ blockerId: blocker.id, blockedId: blocked.id });

    const now = this.clock.now();
    this.publisher.publish(taskUpdatedEvent(blocked, ['dependencies'], actor.userId, now), taskUpdatedEvent(blocker, ['dependencies'], actor.userId, now));
    return this.read.detail(actor, blocked.id);
  }
}
