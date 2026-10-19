import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { UpdateSectionInput } from '@hearth/contracts';
import { NotFoundError, PROJECT_REPOSITORY, type Actor, type Clock, type ProjectRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';

export class UpdateSectionCommand {
  constructor(
    readonly actor: Actor,
    readonly sectionId: string,
    readonly input: UpdateSectionInput,
  ) {}
}

/** Rename and/or reorder a section through its Project aggregate (ordering stays dense). */
@CommandHandler(UpdateSectionCommand)
export class UpdateSectionHandler implements ICommandHandler<UpdateSectionCommand, { id: string; name: string; position: number }> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, sectionId, input }: UpdateSectionCommand) {
    const project = await this.projects.findBySectionId(actor.workspaceId, sectionId);
    if (!project) throw new NotFoundError('Section', sectionId);
    this.access.assert(actor, 'projects.manage', { projectId: project.id });
    const now = this.clock.now();
    if (input.name !== undefined) project.renameSection(sectionId, input.name, actor.userId, now);
    if (input.position !== undefined) project.moveSection(sectionId, input.position, actor.userId, now);
    await this.projects.save(project);
    this.events.publishFrom(project);
    const s = project.sections.find((x) => x.id === sectionId)!;
    return { id: s.id, name: s.name, position: s.position };
  }
}
