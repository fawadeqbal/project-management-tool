import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import { NotFoundError, SPRINT_REPOSITORY, parseDateOnly, type Clock, type SprintRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SPRINT_TASK_STORE, toSprintSummary, type SprintTaskStore } from '../sprints.ports';
import { UpdateSprintCommand } from './update-sprint.command';

@CommandHandler(UpdateSprintCommand)
export class UpdateSprintHandler implements ICommandHandler<UpdateSprintCommand, SprintSummaryDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, sprintId, input }: UpdateSprintCommand): Promise<SprintSummaryDto> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
    this.access.assert(actor, 'sprints.manage', { projectId: sprint.projectId });
    sprint.updateDetails(
      {
        name: input.name,
        goal: input.goal,
        startDate: input.startDate ? parseDateOnly(input.startDate) : undefined,
        endDate: input.endDate ? parseDateOnly(input.endDate) : undefined,
      },
      actor.userId,
      this.clock.now(),
    );
    await this.sprints.save(sprint);
    this.events.publishFrom(sprint);
    return toSprintSummary(sprint, await this.tasks.itemsInSprint(sprint.id));
  }
}
