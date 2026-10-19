import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateProjectInput } from '@hearth/contracts';
import {
  NotFoundError,
  parseDateOnly,
  Project,
  PROJECT_REPOSITORY,
  type Actor,
  type Clock,
  type ProjectRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { FAVORITE_STORE, TEAM_DIRECTORY, type FavoriteStore, type TeamDirectory } from '../projects.ports';

export class CreateProjectCommand {
  constructor(
    readonly actor: Actor,
    readonly input: CreateProjectInput,
  ) {}
}

/** Creates a project owned by the actor (and favorites it for them so it shows in the sidebar). */
@CommandHandler(CreateProjectCommand)
export class CreateProjectHandler implements ICommandHandler<CreateProjectCommand, { id: string }> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    @Inject(FAVORITE_STORE) private readonly favorites: FavoriteStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, input }: CreateProjectCommand): Promise<{ id: string }> {
    this.access.assert(actor, 'projects.create');
    if (input.teamId && !(await this.teams.exists(actor.workspaceId, input.teamId)))
      throw new NotFoundError('Team', input.teamId);
    const project = Project.create(
      {
        id: this.projects.nextId(),
        workspaceId: actor.workspaceId,
        ownerId: actor.userId,
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        teamId: input.teamId ?? null,
        startDate: input.startDate ? parseDateOnly(input.startDate) : null,
        dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
      },
      this.clock.now(),
    );
    await this.projects.save(project);
    await this.favorites.add(actor.userId, project.id);
    this.events.publishFrom(project);
    return { id: project.id };
  }
}
