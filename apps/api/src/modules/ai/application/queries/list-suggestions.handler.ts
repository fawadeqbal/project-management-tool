import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { AiSuggestionDto } from '@hearth/contracts';
import { AiSuggestionReadModel } from '../../infrastructure/ai-suggestion.read-model';
import { ListSuggestionsQuery } from './list-suggestions.query';

@QueryHandler(ListSuggestionsQuery)
export class ListSuggestionsHandler implements IQueryHandler<ListSuggestionsQuery, AiSuggestionDto[]> {
  constructor(private readonly read: AiSuggestionReadModel) {}
  execute({ actor, taskId }: ListSuggestionsQuery): Promise<AiSuggestionDto[]> {
    return this.read.pending(actor.workspaceId, taskId);
  }
}
