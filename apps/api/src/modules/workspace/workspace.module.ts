import { Module } from '@nestjs/common';
import { WorkspaceReadModel } from './infrastructure/workspace.read-model';
import { GetShellHandler, ListMembersHandler, ListTagsHandler, ListTeamsHandler } from './application/workspace.queries';
import { CreateTagHandler } from './application/create-tag.handler';
import { WorkspaceController } from './presentation/workspace.controller';

/** Workspace bounded context (read-mostly): people directory, teams, tags and the app-shell summary. */
@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceReadModel, ListMembersHandler, ListTeamsHandler, ListTagsHandler, GetShellHandler, CreateTagHandler],
  exports: [WorkspaceReadModel],
})
export class WorkspaceModule {}
