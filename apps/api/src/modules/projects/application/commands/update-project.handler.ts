import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { UpdateProjectInput } from '@hearth/contracts';
import {
  NotFoundError,
  parseDateOnly,
  PROJECT_REPOSITORY,
  type Actor,
  type Clock,
  type ProjectRepository,
} from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { TEAM_DIRECTORY, type TeamDirectory } from '../projects.ports';
import { loadProject } from './load-project';

export class UpdateProjectCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly input: UpdateProjectInput,
  ) {}
}

/** Rename, describe, recolor, re-team, reschedule, override health or change WIP limits. */
@CommandHandler(UpdateProjectCommand)
export class UpdateProjectHandler implements ICommandHandler<
  UpdateProjectCommand,
  { id: string; changed: string[] }
> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute({
    actor,
    projectId,
    input,
  }: UpdateProjectCommand): Promise<{ id: string; changed: string[] }> {
    const project = await loadProject(this.projects, actor, projectId);
    this.access.assert(actor, 'projects.manage', { projectId });
    if (input.teamId && !(await this.teams.exists(actor.workspaceId, input.teamId)))
      throw new NotFoundError('Team', input.teamId);
    const date = (v: string | null | undefined) =>
      v === undefined ? undefined : v ? parseDateOnly(v) : null;
    const changed = project.update(
      {
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        teamId: input.teamId,
        health: input.health,
        startDate: date(input.startDate),
        dueDate: date(input.dueDate),
        wipLimits: input.wipLimits,
      },
      actor.userId,
      this.clock.now(),
    );
    if (changed.length) {
      await this.projects.save(project);
      this.events.publishFrom(project);
    }
    return { id: project.id, changed };
  }
}
