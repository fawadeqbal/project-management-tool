import type { Actor } from '@hearth/domain';

export class RemoveSprintTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
    readonly taskId: string,
  ) {}
}
