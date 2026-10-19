import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { SearchResultDto } from '@hearth/contracts';
import { SearchReadModel } from '../../infrastructure/search.read-model';
import { SearchQuery } from './search.query';

@QueryHandler(SearchQuery)
export class SearchHandler implements IQueryHandler<SearchQuery, SearchResultDto> {
  constructor(private readonly read: SearchReadModel) {}
  execute({ actor, input }: SearchQuery): Promise<SearchResultDto> {
    return this.read.search(actor, input);
  }
}
