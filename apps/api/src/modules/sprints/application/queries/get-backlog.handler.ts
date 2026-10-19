import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { SprintTaskDto } from '@hearth/contracts';
import { AccessService } from '../../../../shared/access/access.service';
import { SprintsReadModel } from '../../infrastructure/sprints.read-model';
import { GetBacklogQuery } from './get-backlog.query';

@QueryHandler(GetBacklogQuery)
export class GetBacklogHandler implements IQueryHandler<GetBacklogQuery, SprintTaskDto[]> {
  constructor(
    private readonly read: SprintsReadModel,
    private readonly access: AccessService,
  ) {}
  execute({ actor, projectId }: GetBacklogQuery) {
    this.access.assert(actor, 'tasks.view', { projectId });
    return this.read.backlog(actor, projectId);
  }
}
