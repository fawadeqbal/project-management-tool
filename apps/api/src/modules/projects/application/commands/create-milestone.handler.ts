import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateMilestoneInput, MilestoneDto } from '@hearth/contracts';
import {
  createEvent,
  parseDateOnly,
  PROJECT_REPOSITORY,
  type Actor,
  type Clock,
  type ProjectRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { MILESTONE_STORE, type MilestoneStore } from '../projects.ports';
import { loadProject } from './load-project';
import { assertTasksInProject, toMilestoneDto } from './milestone-mapper';

export class CreateMilestoneCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly input: CreateMilestoneInput,
  ) {}
}

@CommandHandler(CreateMilestoneCommand)
export class CreateMilestoneHandler implements ICommandHandler<CreateMilestoneCommand, MilestoneDto> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(MILESTONE_STORE) private readonly milestones: MilestoneStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, projectId, input }: CreateMilestoneCommand): Promise<MilestoneDto> {
    const project = await loadProject(this.projects, actor, projectId);
    this.access.assert(actor, 'projects.manage', { projectId });
    const dependsOnTaskIds = await assertTasksInProject(
      this.milestones,
      project.id,
      input.dependsOnTaskIds ?? [],
    );
    const milestone = {
      id: this.milestones.nextId(),
      projectId: project.id,
      name: input.name.trim(),
      date: parseDateOnly(input.date),
      doneAt: null,
      dependsOnTaskIds,
    };
    await this.milestones.save(milestone);
    this.events.publish(
      createEvent(
        'milestone.created',
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          aggregateId: milestone.id,
          occurredAt: this.clock.now(),
        },
        {
          projectId: project.id,
          name: milestone.name,
          date: input.date,
        },
      ),
    );
    return toMilestoneDto(milestone);
  }
}
