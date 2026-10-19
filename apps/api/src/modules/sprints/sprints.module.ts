import { Module } from '@nestjs/common';
import { SPRINT_REPOSITORY } from '@hearth/domain';
import { PrismaSprintRepository } from './infrastructure/prisma-sprint.repository';
import { PrismaSprintTaskStore } from './infrastructure/prisma-sprint-task.store';
import { PrismaSprintSnapshotStore } from './infrastructure/prisma-sprint-snapshot.store';
import { SprintsReadModel } from './infrastructure/sprints.read-model';
import { SPRINT_SNAPSHOT_STORE, SPRINT_TASK_STORE } from './application/sprints.ports';
import { ListSprintsHandler } from './application/queries/list-sprints.handler';
import { GetSprintHandler } from './application/queries/get-sprint.handler';
import { GetBacklogHandler } from './application/queries/get-backlog.handler';
import { PlanSprintHandler } from './application/commands/plan-sprint.handler';
import { UpdateSprintHandler } from './application/commands/update-sprint.handler';
import { StartSprintHandler } from './application/commands/start-sprint.handler';
import { CompleteSprintHandler } from './application/commands/complete-sprint.handler';
import { AddSprintTaskHandler } from './application/commands/add-sprint-task.handler';
import { RemoveSprintTaskHandler } from './application/commands/remove-sprint-task.handler';
import { RankBacklogHandler } from './application/commands/rank-backlog.handler';
import { BurndownSnapshotHandler } from './application/events/burndown-snapshot.handler';
import { SprintsController } from './presentation/sprints.controller';

/**
 * Sprints bounded context: sprint lifecycle (Sprint aggregate), backlog ranking, burndown
 * snapshots (from task events), velocity and capacity warnings, completion with retrospective.
 */
@Module({
  controllers: [SprintsController],
  providers: [
    { provide: SPRINT_REPOSITORY, useClass: PrismaSprintRepository },
    { provide: SPRINT_TASK_STORE, useClass: PrismaSprintTaskStore },
    { provide: SPRINT_SNAPSHOT_STORE, useClass: PrismaSprintSnapshotStore },
    SprintsReadModel,
    ListSprintsHandler,
    GetSprintHandler,
    GetBacklogHandler,
    PlanSprintHandler,
    UpdateSprintHandler,
    StartSprintHandler,
    CompleteSprintHandler,
    AddSprintTaskHandler,
    RemoveSprintTaskHandler,
    RankBacklogHandler,
    BurndownSnapshotHandler,
  ],
})
export class SprintsModule {}
