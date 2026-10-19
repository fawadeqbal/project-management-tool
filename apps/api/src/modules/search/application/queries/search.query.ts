import type { SearchQuery as SearchQueryInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class SearchQuery {
  constructor(
    readonly actor: Actor,
    readonly input: SearchQueryInput,
  ) {}
}
