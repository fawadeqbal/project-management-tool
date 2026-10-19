import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundError, ValidationError, createEvent, positionBetween, type Clock } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { SPRINT_TASK_STORE, type SprintTaskFacts, type SprintTaskStore } from '../sprints.ports';
import { RankBacklogCommand } from './rank-backlog.command';

/** Drag-to-rank in the backlog: one row written via fractional ranking (positionBetween). */
@CommandHandler(RankBacklogCommand)
export class RankBacklogHandler implements ICommandHandler<
  RankBacklogCommand,
  { taskId: string; backlogRank: number }
> {
  constructor(
    @Inject(SPRINT_TASK_STORE) private readonly tasks: SprintTaskStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, projectId, input }: RankBacklogCommand) {
    this.access.assert(actor, 'sprints.manage', { projectId });
    const load = async (id: string | null | undefined): Promise<SprintTaskFacts | null> => {
      if (!id) return null;
      const t = await this.tasks.findTask(actor.workspaceId, id);
      if (!t || t.projectId !== projectId) throw new NotFoundError('Task', id);
      return t;
    };
    const [task, before, after] = await Promise.all([
      load(input.taskId),
      load(input.beforeId),
      load(input.afterId),
    ]);
    if (!task) throw new NotFoundError('Task', input.taskId);
    if (task.sprintId)
      throw new ValidationError(
        'backlog.in_sprint',
        'That task is in a sprint. Remove it from the sprint to rank it in the backlog.',
      );
    const rank = positionBetween(before?.backlogRank ?? null, after?.backlogRank ?? null);
    await this.tasks.setBacklogRank(task.id, rank);
    this.events.publish(
      createEvent(
        'backlog.ranked',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: task.id,
          occurredAt: this.clock.now(),
        },
        { projectId, backlogRank: rank },
      ),
    );
    return { taskId: task.id, backlogRank: rank };
  }
}
