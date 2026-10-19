import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import {
  NotFoundError,
  SPRINT_REPOSITORY,
  ValidationError,
  type Clock,
  type SprintRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SPRINT_TASK_STORE, toSprintSummary, type SprintTaskStore } from '../sprints.ports';
import { AddSprintTaskCommand } from './add-sprint-task.command';

/** Adds a task to a sprint. After the sprint started this is a scope change (recorded by the event). */
@CommandHandler(AddSprintTaskCommand)
export class AddSprintTaskHandler implements ICommandHandler<AddSprintTaskCommand, SprintSummaryDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, sprintId, taskId }: AddSprintTaskCommand): Promise<SprintSummaryDto> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
    this.access.assert(actor, 'sprints.manage', { projectId: sprint.projectId });
    const task = await this.tasks.findTask(actor.workspaceId, taskId);
    if (!task) throw new NotFoundError('Task', taskId);
    if (task.projectId !== sprint.projectId)
      throw new ValidationError(
        'sprint.task_project',
        'That task belongs to another project. Move it to this project first.',
      );
    if (task.sprintId !== sprint.id) {
      sprint.addTask({ id: task.id, points: task.points }, actor.userId, this.clock.now());
      await this.tasks.moveToSprint([task.id], sprint.id);
      this.events.publishFrom(sprint);
    }
    return toSprintSummary(sprint, await this.tasks.itemsInSprint(sprint.id));
  }
}
