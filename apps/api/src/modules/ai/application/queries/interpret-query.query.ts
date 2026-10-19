import type { Actor } from '@hearth/domain';

/** "overdue design" → a My tasks filter, using the workspace's own vocabulary. */
export class InterpretQueryQuery {
  constructor(
    readonly actor: Actor,
    readonly query: string,
  ) {}
}
