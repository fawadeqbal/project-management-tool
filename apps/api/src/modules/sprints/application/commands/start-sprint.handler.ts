import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import { NotFoundError, SPRINT_REPOSITORY, sprintSnapshotOf, type Clock, type SprintRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SPRINT_SNAPSHOT_STORE, SPRINT_TASK_STORE, toSprintSummary, type SprintSnapshotStore, type SprintTaskStore } from '../sprints.ports';
import { StartSprintCommand } from './start-sprint.command';

/** Starts a planned sprint: commits to the points in it now. One active sprint per project. */
@CommandHandler(StartSprintCommand)
export class StartSprintHandler implements ICommandHandler<StartSprintCommand, SprintSummaryDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    @Inject(SPRINT_SNAPSHOT_STORE) private readonly snapshots: SprintSnapshotStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, sprintId }: StartSprintCommand): Promise<SprintSummaryDto> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
    this.access.assert(actor, 'sprints.manage', { projectId: sprint.projectId });
    const active = await this.sprints.findActive(sprint.projectId);
    const items = await this.tasks.itemsInSprint(sprint.id);
    const { remainingPoints, scopePoints } = sprintSnapshotOf(items);
    const now = this.clock.now();
    sprint.start(scopePoints, !!active && active.id !== sprint.id, actor.userId, now);
    await this.sprints.save(sprint);
    // Day one of the burndown: the committed line starts here.
    await this.snapshots.upsert(sprint.id, now, remainingPoints, scopePoints);
    this.events.publishFrom(sprint);
    return toSprintSummary(sprint, items);
  }
}
