import { Module } from '@nestjs/common';
import { GenerateSuggestionHandler } from './application/commands/generate-suggestion.handler';
import { AcceptSuggestionHandler } from './application/commands/accept-suggestion.handler';
import { DiscardSuggestionHandler } from './application/commands/discard-suggestion.handler';
import { ListSuggestionsHandler } from './application/queries/list-suggestions.handler';
import { InterpretQueryHandler } from './application/queries/interpret-query.handler';
import { aiProviderFactory } from './infrastructure/ai-provider.factory';
import { AiTaskContextLoader } from './infrastructure/ai-task-context.loader';
import { AiUsageMeter } from './infrastructure/ai-usage.meter';
import { AiSuggestionReadModel } from './infrastructure/ai-suggestion.read-model';
import { AiController } from './presentation/ai.controller';

/**
 * AI bounded context. The AiProvider port has two strategies (local heuristics, Anthropic with
 * local fallback) chosen by config; every output is a suggestion a person accepts or discards.
 */
@Module({
  controllers: [AiController],
  providers: [
    aiProviderFactory,
    AiTaskContextLoader,
    AiUsageMeter,
    AiSuggestionReadModel,
    GenerateSuggestionHandler,
    AcceptSuggestionHandler,
    DiscardSuggestionHandler,
    ListSuggestionsHandler,
    InterpretQueryHandler,
  ],
})
export class AiModule {}
