import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { MemberDto, ShellDto, TagDto, TeamDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { WorkspaceReadModel } from '../infrastructure/workspace.read-model';

export class ListMembersQuery {
  constructor(readonly actor: Actor) {}
}
export class ListTeamsQuery {
  constructor(readonly actor: Actor) {}
}
export class ListTagsQuery {
  constructor(readonly actor: Actor) {}
}
export class GetShellQuery {
  constructor(readonly actor: Actor) {}
}

@QueryHandler(ListMembersQuery)
export class ListMembersHandler implements IQueryHandler<ListMembersQuery, MemberDto[]> {
  constructor(private readonly read: WorkspaceReadModel) {}
  execute({ actor }: ListMembersQuery) {
    return this.read.members(actor);
  }
}

@QueryHandler(ListTeamsQuery)
export class ListTeamsHandler implements IQueryHandler<ListTeamsQuery, TeamDto[]> {
  constructor(private readonly read: WorkspaceReadModel) {}
  execute({ actor }: ListTeamsQuery) {
    return this.read.teams(actor.workspaceId);
  }
}

@QueryHandler(ListTagsQuery)
export class ListTagsHandler implements IQueryHandler<ListTagsQuery, TagDto[]> {
  constructor(private readonly read: WorkspaceReadModel) {}
  execute({ actor }: ListTagsQuery) {
    return this.read.tags(actor.workspaceId);
  }
}

@QueryHandler(GetShellQuery)
export class GetShellHandler implements IQueryHandler<GetShellQuery, ShellDto> {
  constructor(private readonly read: WorkspaceReadModel) {}
  execute({ actor }: GetShellQuery) {
    return this.read.shell(actor);
  }
}
