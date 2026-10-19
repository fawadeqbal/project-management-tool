import type { Actor } from '@hearth/domain';

export class StartSprintCommand {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
  ) {}
}
