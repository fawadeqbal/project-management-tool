import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateTaskInput, TaskDetailDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TaskCreationService } from '../task-creation.service';

export class CreateTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly input: CreateTaskInput,
  ) {}
}

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand, TaskDetailDto> {
  constructor(
    private readonly creation: TaskCreationService,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, input }: CreateTaskCommand): Promise<TaskDetailDto> {
    const task = await this.creation.create(actor, input);
    return this.read.detail(actor, task.id);
  }
}
