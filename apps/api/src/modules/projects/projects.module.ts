import { Module } from '@nestjs/common';
import { PROJECT_REPOSITORY } from '@hearth/domain';
import { FAVORITE_STORE, MILESTONE_STORE, TEAM_DIRECTORY } from './application/projects.ports';
import { CreateProjectHandler } from './application/commands/create-project.handler';
import { UpdateProjectHandler } from './application/commands/update-project.handler';
import { SetFavoriteHandler } from './application/commands/favorite-project.handler';
import { CreateSectionHandler } from './application/commands/create-section.handler';
import { UpdateSectionHandler } from './application/commands/update-section.handler';
import { DeleteSectionHandler } from './application/commands/delete-section.handler';
import { CreateMilestoneHandler } from './application/commands/create-milestone.handler';
import { UpdateMilestoneHandler } from './application/commands/update-milestone.handler';
import { DeleteMilestoneHandler } from './application/commands/delete-milestone.handler';
import { GetBoardHandler, GetProjectHandler, ListProjectsHandler, ListTeamProjectsHandler } from './application/queries/project.queries';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { PrismaFavoriteStore, PrismaMilestoneStore, PrismaTeamDirectory } from './infrastructure/prisma-project-stores';
import { ProjectsReadModel } from './infrastructure/projects.read-model';
import { ProjectsController } from './presentation/projects.controller';

/**
 * Projects bounded context: projects (aggregate with section ordering and WIP limits),
 * favorites, milestones, board columns and team project lists. See docs/ARCHITECTURE.md.
 */
@Module({
  controllers: [ProjectsController],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    { provide: FAVORITE_STORE, useClass: PrismaFavoriteStore },
    { provide: MILESTONE_STORE, useClass: PrismaMilestoneStore },
    { provide: TEAM_DIRECTORY, useClass: PrismaTeamDirectory },
    ProjectsReadModel,
    CreateProjectHandler,
    UpdateProjectHandler,
    SetFavoriteHandler,
    CreateSectionHandler,
    UpdateSectionHandler,
    DeleteSectionHandler,
    CreateMilestoneHandler,
    UpdateMilestoneHandler,
    DeleteMilestoneHandler,
    ListProjectsHandler,
    GetProjectHandler,
    GetBoardHandler,
    ListTeamProjectsHandler,
  ],
})
export class ProjectsModule {}
