import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { BoardDto, ProjectDetailDto, ProjectSummaryDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { ProjectsReadModel } from '../../infrastructure/projects.read-model';

export class ListProjectsQuery {
  constructor(readonly actor: Actor) {}
}
export class GetProjectQuery {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
  ) {}
}
export class GetBoardQuery {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
  ) {}
}
export class ListTeamProjectsQuery {
  constructor(
    readonly actor: Actor,
    readonly teamId: string,
  ) {}
}

@QueryHandler(ListProjectsQuery)
export class ListProjectsHandler implements IQueryHandler<ListProjectsQuery, ProjectSummaryDto[]> {
  constructor(private readonly read: ProjectsReadModel) {}
  execute({ actor }: ListProjectsQuery) {
    return this.read.list(actor);
  }
}

@QueryHandler(GetProjectQuery)
export class GetProjectHandler implements IQueryHandler<GetProjectQuery, ProjectDetailDto> {
  constructor(private readonly read: ProjectsReadModel) {}
  execute({ actor, projectId }: GetProjectQuery) {
    return this.read.detail(actor, projectId);
  }
}

@QueryHandler(GetBoardQuery)
export class GetBoardHandler implements IQueryHandler<GetBoardQuery, BoardDto> {
  constructor(private readonly read: ProjectsReadModel) {}
  execute({ actor, projectId }: GetBoardQuery) {
    return this.read.board(actor, projectId);
  }
}

@QueryHandler(ListTeamProjectsQuery)
export class ListTeamProjectsHandler implements IQueryHandler<ListTeamProjectsQuery, ProjectSummaryDto[]> {
  constructor(private readonly read: ProjectsReadModel) {}
  execute({ actor, teamId }: ListTeamProjectsQuery) {
    return this.read.teamProjects(actor, teamId);
  }
}
