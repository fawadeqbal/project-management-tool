import type { Actor } from '@hearth/domain';

export class AddSprintTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
    readonly taskId: string,
  ) {}
}
