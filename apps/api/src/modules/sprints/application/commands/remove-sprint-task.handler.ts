import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import {
  NotFoundError,
  SPRINT_REPOSITORY,
  ranksAtTop,
  type Clock,
  type SprintRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SPRINT_TASK_STORE, toSprintSummary, type SprintTaskStore } from '../sprints.ports';
import { RemoveSprintTaskCommand } from './remove-sprint-task.command';

/** Moves a task out of a sprint, back to the top of the backlog. */
@CommandHandler(RemoveSprintTaskCommand)
export class RemoveSprintTaskHandler implements ICommandHandler<RemoveSprintTaskCommand, SprintSummaryDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, sprintId, taskId }: RemoveSprintTaskCommand): Promise<SprintSummaryDto> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
    this.access.assert(actor, 'sprints.manage', { projectId: sprint.projectId });
    const task = await this.tasks.findTask(actor.workspaceId, taskId);
    if (!task || task.sprintId !== sprint.id) throw new NotFoundError('Task', taskId);
    sprint.removeTask({ id: task.id, points: task.points }, actor.userId, this.clock.now());
    const [rank] = ranksAtTop(await this.tasks.topBacklogRank(sprint.projectId), 1);
    await this.tasks.moveToBacklog([{ taskId: task.id, rank: rank! }]);
    this.events.publishFrom(sprint);
    return toSprintSummary(sprint, await this.tasks.itemsInSprint(sprint.id));
  }
}
