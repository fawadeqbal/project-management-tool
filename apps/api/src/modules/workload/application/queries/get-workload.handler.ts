import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { WorkloadDto } from '@hearth/contracts';
import { WorkloadReadModel } from '../../infrastructure/workload.read-model';
import { GetWorkloadQuery } from './get-workload.query';

@QueryHandler(GetWorkloadQuery)
export class GetWorkloadHandler implements IQueryHandler<GetWorkloadQuery, WorkloadDto> {
  constructor(private readonly read: WorkloadReadModel) {}
  execute({ actor, query }: GetWorkloadQuery): Promise<WorkloadDto> {
    return this.read.workload(actor, query);
  }
}
