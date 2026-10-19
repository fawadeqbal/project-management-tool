import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { TaskDetailDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { TaskReadModel } from '../../infrastructure/task.read-model';

export class GetTaskByKeyQuery {
  constructor(
    readonly actor: Actor,
    /** "HRT-188" (case-insensitive) or a bare number. */
    readonly key: string,
  ) {}
}

@QueryHandler(GetTaskByKeyQuery)
export class GetTaskByKeyHandler implements IQueryHandler<GetTaskByKeyQuery, TaskDetailDto> {
  constructor(
    private readonly read: TaskReadModel,
    private readonly access: AccessService,
  ) {}

  async execute({ actor, key }: GetTaskByKeyQuery): Promise<TaskDetailDto> {
    const id = await this.read.idForKey(actor.workspaceId, key);
    const task = await this.read.detail(actor, id);
    this.access.assert(actor, 'tasks.view', { projectId: task.projectId });
    return task;
  }
}
