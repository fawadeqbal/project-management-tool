import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { TimelineDto, TimelineQuery } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { TimelineReadModel } from '../../infrastructure/timeline.read-model';

export class GetTimelineQuery {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly range: TimelineQuery,
  ) {}
}

@QueryHandler(GetTimelineQuery)
export class GetTimelineHandler implements IQueryHandler<GetTimelineQuery, TimelineDto> {
  constructor(private readonly read: TimelineReadModel) {}
  execute({ actor, projectId, range }: GetTimelineQuery) {
    return this.read.timeline(actor, projectId, range);
  }
}
