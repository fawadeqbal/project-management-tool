import { Module } from '@nestjs/common';
import { SearchHandler } from './application/queries/search.handler';
import { SearchReadModel } from './infrastructure/search.read-model';
import { SearchController } from './presentation/search.controller';

/** Search bounded context: ⌘K server-side search across tasks, projects and people. */
@Module({
  controllers: [SearchController],
  providers: [SearchReadModel, SearchHandler],
})
export class SearchModule {}
