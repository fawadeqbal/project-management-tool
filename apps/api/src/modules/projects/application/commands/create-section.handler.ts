import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateSectionInput, SectionDto } from '@hearth/contracts';
import { PROJECT_REPOSITORY, type Actor, type Clock, type ProjectRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { loadProject } from './load-project';

export class CreateSectionCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly input: CreateSectionInput,
  ) {}
}

@CommandHandler(CreateSectionCommand)
export class CreateSectionHandler implements ICommandHandler<CreateSectionCommand, SectionDto> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, projectId, input }: CreateSectionCommand): Promise<SectionDto> {
    const project = await loadProject(this.projects, actor, projectId);
    this.access.assert(actor, 'projects.manage', { projectId });
    const section = project.addSection(
      this.projects.nextSectionId(),
      input.name,
      input.beforeId,
      actor.userId,
      this.clock.now(),
    );
    await this.projects.save(project);
    this.events.publishFrom(project);
    return { ...section, taskCount: 0 };
  }
}
