import { Module } from '@nestjs/common';
import { WorkloadReadModel } from './infrastructure/workload.read-model';
import { GetWorkloadHandler } from './application/queries/get-workload.handler';
import { ListTimeOffHandler } from './application/queries/list-time-off.handler';
import { CreateTimeOffHandler } from './application/commands/create-time-off.handler';
import { DeleteTimeOffHandler } from './application/commands/delete-time-off.handler';
import { UpdateCapacityHandler } from './application/commands/update-capacity.handler';
import { WorkloadController } from './presentation/workload.controller';

/**
 * Workload bounded context: capacity vs planned work per person per day, time off and rebalance
 * suggestions. Reassigning a task (accepting a suggestion) goes through the Tasks context.
 */
@Module({
  controllers: [WorkloadController],
  providers: [
    WorkloadReadModel,
    GetWorkloadHandler,
    ListTimeOffHandler,
    CreateTimeOffHandler,
    DeleteTimeOffHandler,
    UpdateCapacityHandler,
  ],
})
export class WorkloadModule {}
