import type { Actor } from '@hearth/domain';

export class CompleteSprintCommand {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
    readonly moveUnfinishedTo: 'backlog' | 'next',
  ) {}
}
