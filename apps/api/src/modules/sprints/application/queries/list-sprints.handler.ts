import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { SprintSummaryDto } from '@hearth/contracts';
import { AccessService } from '../../../../shared/access/access.service';
import { SprintsReadModel } from '../../infrastructure/sprints.read-model';
import { ListSprintsQuery } from './list-sprints.query';

@QueryHandler(ListSprintsQuery)
export class ListSprintsHandler implements IQueryHandler<ListSprintsQuery, SprintSummaryDto[]> {
  constructor(
    private readonly read: SprintsReadModel,
    private readonly access: AccessService,
  ) {}
  execute({ actor, projectId }: ListSprintsQuery) {
    this.access.assert(actor, 'tasks.view', { projectId });
    return this.read.list(actor, projectId);
  }
}
