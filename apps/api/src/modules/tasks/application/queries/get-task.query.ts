import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { TaskDetailDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { AccessService } from '../../../../shared/access/access.service';
import { TaskReadModel } from '../../infrastructure/task.read-model';

export class GetTaskQuery {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
  ) {}
}

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery, TaskDetailDto> {
  constructor(
    private readonly read: TaskReadModel,
    private readonly access: AccessService,
  ) {}

  async execute({ actor, taskId }: GetTaskQuery): Promise<TaskDetailDto> {
    const task = await this.read.detail(actor, taskId);
    this.access.assert(actor, 'tasks.view', { projectId: task.projectId });
    return task;
  }
}
