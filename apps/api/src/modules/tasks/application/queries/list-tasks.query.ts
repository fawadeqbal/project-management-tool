import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { ListTasksQuery as ListTasksParams, TaskDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { TaskReadModel } from '../../infrastructure/task.read-model';

export class ListTasksQuery {
  constructor(
    readonly actor: Actor,
    readonly params: ListTasksParams,
  ) {}
}

@QueryHandler(ListTasksQuery)
export class ListTasksHandler implements IQueryHandler<ListTasksQuery, TaskDto[]> {
  constructor(
    private readonly read: TaskReadModel,
    private readonly access: AccessService,
  ) {}

  execute({ actor, params }: ListTasksQuery): Promise<TaskDto[]> {
    // A guest asking for a project they're not on gets a 403, not an empty list.
    this.access.assert(actor, 'tasks.view', params.projectId ? { projectId: params.projectId } : undefined);
    return this.read.list(actor, params);
  }
}
