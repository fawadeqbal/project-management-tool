import type { Actor } from '@hearth/domain';

export class GetSprintQuery {
  constructor(
    readonly actor: Actor,
    readonly sprintId: string,
  ) {}
}
