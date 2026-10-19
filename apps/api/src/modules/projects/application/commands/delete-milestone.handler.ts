import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createEvent, NotFoundError, type Actor, type Clock } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { MILESTONE_STORE, type MilestoneStore } from '../projects.ports';

export class DeleteMilestoneCommand {
  constructor(
    readonly actor: Actor,
    readonly milestoneId: string,
  ) {}
}

@CommandHandler(DeleteMilestoneCommand)
export class DeleteMilestoneHandler implements ICommandHandler<DeleteMilestoneCommand, void> {
  constructor(
    @Inject(MILESTONE_STORE) private readonly milestones: MilestoneStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, milestoneId }: DeleteMilestoneCommand): Promise<void> {
    const m = await this.milestones.findById(actor.workspaceId, milestoneId);
    if (!m || !this.access.allows(actor, 'tasks.view', { projectId: m.projectId }))
      throw new NotFoundError('Milestone', milestoneId);
    this.access.assert(actor, 'projects.manage', { projectId: m.projectId });
    await this.milestones.delete(m.id);
    this.events.publish(
      createEvent(
        'milestone.deleted',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: m.id,
          occurredAt: this.clock.now(),
        },
        {
          projectId: m.projectId,
          name: m.name,
        },
      ),
    );
  }
}
