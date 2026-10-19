import type { WorkloadQuery } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class GetWorkloadQuery {
  constructor(
    readonly actor: Actor,
    readonly query: WorkloadQuery,
  ) {}
}
