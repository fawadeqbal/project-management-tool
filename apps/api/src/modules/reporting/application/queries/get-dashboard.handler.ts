import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { DashboardDto } from '@hearth/contracts';
import { AccessService } from '../../../../shared/access/access.service';
import { DashboardReadModel } from '../../infrastructure/dashboard.read-model';
import { GetDashboardQuery } from './get-dashboard.query';

/** Dashboards stay viewable on every plan (preview); only layout and schedule writes are gated. */
@QueryHandler(GetDashboardQuery)
export class GetDashboardHandler implements IQueryHandler<GetDashboardQuery, DashboardDto> {
  constructor(
    private readonly read: DashboardReadModel,
    private readonly access: AccessService,
  ) {}

  execute({ actor, query }: GetDashboardQuery): Promise<DashboardDto> {
    this.access.assert(actor, 'reports.view', query.projectId ? { projectId: query.projectId } : undefined);
    return this.read.get(actor, query);
  }
}
