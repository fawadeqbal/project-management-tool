import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundError,
  PROJECT_REPOSITORY,
  type Actor,
  type Clock,
  type ProjectRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';

export class DeleteSectionCommand {
  constructor(
    readonly actor: Actor,
    readonly sectionId: string,
  ) {}
}

/** Removes a section; its tasks stay in the project without a section. */
@CommandHandler(DeleteSectionCommand)
export class DeleteSectionHandler implements ICommandHandler<DeleteSectionCommand, void> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, sectionId }: DeleteSectionCommand): Promise<void> {
    const project = await this.projects.findBySectionId(actor.workspaceId, sectionId);
    if (!project) throw new NotFoundError('Section', sectionId);
    this.access.assert(actor, 'projects.manage', { projectId: project.id });
    project.removeSection(sectionId, actor.userId, this.clock.now());
    await this.projects.save(project);
    this.events.publishFrom(project);
  }
}
