import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createEvent, PROJECT_REPOSITORY, type Actor, type Clock, type ProjectRepository } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { FAVORITE_STORE, type FavoriteStore } from '../projects.ports';
import { loadProject } from './load-project';

export class SetFavoriteCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly favorite: boolean,
  ) {}
}

/** Star / unstar a project for the current person (sidebar favorites). Idempotent. */
@CommandHandler(SetFavoriteCommand)
export class SetFavoriteHandler implements ICommandHandler<SetFavoriteCommand, { isFavorite: boolean }> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(FAVORITE_STORE) private readonly favorites: FavoriteStore,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({ actor, projectId, favorite }: SetFavoriteCommand): Promise<{ isFavorite: boolean }> {
    const project = await loadProject(this.projects, actor, projectId);
    this.access.assert(actor, 'tasks.view', { projectId });
    if (favorite) await this.favorites.add(actor.userId, project.id);
    else await this.favorites.remove(actor.userId, project.id);
    this.events.publish(
      createEvent(
        favorite ? 'project.favorited' : 'project.unfavorited',
        { workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId: project.id, occurredAt: this.clock.now() },
        { name: project.name },
      ),
    );
    return { isFavorite: favorite };
  }
}
