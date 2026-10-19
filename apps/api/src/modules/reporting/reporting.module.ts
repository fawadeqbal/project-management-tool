import { Module } from '@nestjs/common';
import { DashboardPreferencesStore } from './infrastructure/dashboard-preferences.store';
import { DashboardReadModel } from './infrastructure/dashboard.read-model';
import { GetDashboardHandler } from './application/queries/get-dashboard.handler';
import { SaveDashboardLayoutHandler } from './application/commands/save-dashboard-layout.handler';
import { ScheduleDashboardHandler } from './application/commands/schedule-dashboard.handler';
import { ReportingController } from './presentation/reporting.controller';

/**
 * Reporting bounded context: the Dashboard read model (KPIs, created vs completed, status mix,
 * project health) plus per-person layout and email schedule (Business feature, write-gated).
 */
@Module({
  controllers: [ReportingController],
  providers: [
    DashboardPreferencesStore,
    DashboardReadModel,
    GetDashboardHandler,
    SaveDashboardLayoutHandler,
    ScheduleDashboardHandler,
  ],
})
export class ReportingModule {}
