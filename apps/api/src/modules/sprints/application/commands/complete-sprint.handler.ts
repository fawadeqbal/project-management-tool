import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { RetrospectiveDto, SprintSummaryDto } from '@hearth/contracts';
import {
  NotFoundError,
  SPRINT_REPOSITORY,
  Sprint,
  buildRetrospective,
  ranksAtTop,
  sprintSnapshotOf,
  type Clock,
  type SprintRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import {
  SPRINT_SNAPSHOT_STORE,
  SPRINT_TASK_STORE,
  toSprintSummary,
  type SprintSnapshotStore,
  type SprintTaskStore,
} from '../sprints.ports';
import { CompleteSprintCommand } from './complete-sprint.command';
import { defaultSprintDates, newSprintId } from './sprint-ids';

/**
 * Completes the active sprint and moves unfinished work — to the top of the backlog, or into the
 * next planned sprint (planned on the spot if there is none). Returns the retrospective summary.
 */
@CommandHandler(CompleteSprintCommand)
export class CompleteSprintHandler implements ICommandHandler<CompleteSprintCommand, RetrospectiveDto> {
  constructor(
    @Inject(SPRINT_REPOSITORY) private readonly sprints: SprintRepository,
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    @Inject(SPRINT_SNAPSHOT_STORE) private readonly snapshots: SprintSnapshotStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, sprintId, moveUnfinishedTo }: CompleteSprintCommand): Promise<RetrospectiveDto> {
    const sprint = await this.sprints.findById(actor.workspaceId, sprintId);
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
    this.access.assert(actor, 'sprints.manage', { projectId: sprint.projectId });
    const now = this.clock.now();
    const items = await this.tasks.itemsInSprint(sprint.id);
    const retro = buildRetrospective(items);
    const unfinishedIds = retro.unfinished.map((t) => t.id);

    sprint.complete(
      { completedPoints: retro.completedPoints, unfinishedTaskIds: unfinishedIds, moveTo: moveUnfinishedTo },
      actor.userId,
      now,
    );
    await this.sprints.save(sprint);
    // The final snapshot is the sprint's record once unfinished work moves on.
    const final = sprintSnapshotOf(items);
    await this.snapshots.upsert(sprint.id, now, final.remainingPoints, final.scopePoints);

    let next: Sprint | null = null;
    if (unfinishedIds.length) {
      if (moveUnfinishedTo === 'next') {
        next = await this.sprints.findNextPlanned(sprint.projectId, sprint.number);
        if (!next) {
          const dates = defaultSprintDates(sprint, now);
          next = Sprint.plan(
            {
              id: newSprintId(),
              projectId: sprint.projectId,
              workspaceId: actor.workspaceId,
              number: await this.sprints.nextNumber(sprint.projectId),
              ...dates,
            },
            actor.userId,
            now,
          );
          await this.sprints.save(next);
        }
        await this.tasks.moveToSprint(unfinishedIds, next.id);
        for (const t of retro.unfinished) next.addTask({ id: t.id, points: t.points }, actor.userId, now);
      } else {
        const ranks = ranksAtTop(await this.tasks.topBacklogRank(sprint.projectId), unfinishedIds.length);
        await this.tasks.moveToBacklog(unfinishedIds.map((taskId, i) => ({ taskId, rank: ranks[i]! })));
      }
    }
    this.events.publishFrom(sprint, ...(next ? [next] : []));

    const summary = toSprintSummary(sprint, items, retro.completedPoints);
    let nextSummary: SprintSummaryDto | null = null;
    if (next) nextSummary = toSprintSummary(next, await this.tasks.itemsInSprint(next.id));
    return {
      sprint: summary,
      completed: retro.completed,
      unfinished: retro.unfinished,
      completedPoints: retro.completedPoints,
      unfinishedPoints: retro.unfinishedPoints,
      completionPct: retro.completionPct,
      movedTo: { kind: moveUnfinishedTo, sprint: nextSummary },
    };
  }
}
