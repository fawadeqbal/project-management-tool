import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { SprintDetailDto } from '@hearth/contracts';
import { AccessService } from '../../../../shared/access/access.service';
import { SprintsReadModel } from '../../infrastructure/sprints.read-model';
import { GetSprintQuery } from './get-sprint.query';

@QueryHandler(GetSprintQuery)
export class GetSprintHandler implements IQueryHandler<GetSprintQuery, SprintDetailDto> {
  constructor(
    private readonly read: SprintsReadModel,
    private readonly access: AccessService,
  ) {}
  async execute({ actor, sprintId }: GetSprintQuery) {
    const detail = await this.read.detail(actor, sprintId);
    this.access.assert(actor, 'tasks.view', { projectId: detail.sprint.projectId });
    return detail;
  }
}
