import type { DashboardQuery } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class GetDashboardQuery {
  constructor(
    readonly actor: Actor,
    readonly query: DashboardQuery,
  ) {}
}
