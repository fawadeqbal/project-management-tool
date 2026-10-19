import type { Actor } from '@hearth/domain';

export class DiscardSuggestionCommand {
  constructor(
    readonly actor: Actor,
    readonly suggestionId: string,
  ) {}
}
