import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { MilestoneDto, UpdateMilestoneInput } from '@hearth/contracts';
import {
  createEvent,
  NotFoundError,
  parseDateOnly,
  toDateOnly,
  type Actor,
  type Clock,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { MILESTONE_STORE, type MilestoneStore } from '../projects.ports';
import { assertTasksInProject, toMilestoneDto } from './milestone-mapper';

export class UpdateMilestoneCommand {
  constructor(
    readonly actor: Actor,
    readonly milestoneId: string,
    readonly input: UpdateMilestoneInput,
  ) {}
}

@CommandHandler(UpdateMilestoneCommand)
export class UpdateMilestoneHandler implements ICommandHandler<UpdateMilestoneCommand, MilestoneDto> {
  constructor(
    @Inject(MILESTONE_STORE) private readonly milestones: MilestoneStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, milestoneId, input }: UpdateMilestoneCommand): Promise<MilestoneDto> {
    const m = await this.milestones.findById(actor.workspaceId, milestoneId);
    if (!m || !this.access.allows(actor, 'tasks.view', { projectId: m.projectId }))
      throw new NotFoundError('Milestone', milestoneId);
    this.access.assert(actor, 'projects.manage', { projectId: m.projectId });
    const now = this.clock.now();
    const next = {
      ...m,
      name: input.name?.trim() ?? m.name,
      date: input.date ? parseDateOnly(input.date) : m.date,
      doneAt: input.done === undefined ? m.doneAt : input.done ? (m.doneAt ?? now) : null,
      dependsOnTaskIds: input.dependsOnTaskIds
        ? await assertTasksInProject(this.milestones, m.projectId, input.dependsOnTaskIds)
        : m.dependsOnTaskIds,
    };
    await this.milestones.save(next);
    this.events.publish(
      createEvent(
        'milestone.updated',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: m.id, occurredAt: now },
        {
          projectId: m.projectId,
          name: next.name,
          date: toDateOnly(next.date),
          fields: Object.keys(input),
        },
      ),
    );
    return toMilestoneDto(next);
  }
}
