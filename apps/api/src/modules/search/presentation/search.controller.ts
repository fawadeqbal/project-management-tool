import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { SearchQuerySchema, type SearchQuery as SearchQueryInput, type SearchResultDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { SearchQuery } from '../application/queries/search.query';

@Controller('search')
export class SearchController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  @RequirePermission('tasks.view')
  search(@CurrentActor() actor: Actor, @Query(new ZodValidationPipe(SearchQuerySchema)) input: SearchQueryInput): Promise<SearchResultDto> {
    return this.queries.execute(new SearchQuery(actor, input));
  }
}
