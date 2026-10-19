import type { Actor } from '@hearth/domain';

export class GetBacklogQuery {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
  ) {}
}
