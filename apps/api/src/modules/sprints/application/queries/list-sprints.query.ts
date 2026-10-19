import type { Actor } from '@hearth/domain';

export class ListSprintsQuery {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
  ) {}
}
