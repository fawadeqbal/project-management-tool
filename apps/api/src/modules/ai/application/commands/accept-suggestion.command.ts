import type { AcceptSuggestionInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class AcceptSuggestionCommand {
  constructor(
    readonly actor: Actor,
    readonly suggestionId: string,
    readonly edited: AcceptSuggestionInput['edited'],
  ) {}
}
