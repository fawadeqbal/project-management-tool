import type { Actor } from '@hearth/domain';

export class ListSuggestionsQuery {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
  ) {}
}
