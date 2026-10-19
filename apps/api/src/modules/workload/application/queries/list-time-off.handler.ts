import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { TimeOffDto } from '@hearth/contracts';
import { WorkloadReadModel } from '../../infrastructure/workload.read-model';
import { ListTimeOffQuery } from './list-time-off.query';

@QueryHandler(ListTimeOffQuery)
export class ListTimeOffHandler implements IQueryHandler<ListTimeOffQuery, TimeOffDto[]> {
  constructor(private readonly read: WorkloadReadModel) {}
  execute({ actor, query }: ListTimeOffQuery): Promise<TimeOffDto[]> {
    return this.read.timeOff(actor.workspaceId, query);
  }
}
