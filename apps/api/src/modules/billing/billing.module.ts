import { Module } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY } from '@hearth/domain';
import { PrismaSubscriptionRepository } from './infrastructure/prisma-subscription.repository';
import { UsageReader } from './infrastructure/usage.reader';
import { BillingReadModel } from './infrastructure/billing.read-model';
import { WorkspaceExportReadModel } from './infrastructure/workspace-export.read-model';
import { GetBillingHandler } from './application/queries/get-billing.handler';
import { GetFeatureLimitHandler } from './application/queries/get-feature-limit.handler';
import { ExportWorkspaceHandler } from './application/queries/export-workspace.handler';
import { ChangePlanHandler } from './application/commands/change-plan.handler';
import { PauseBillingHandler } from './application/commands/pause-billing.handler';
import { ResumeBillingHandler } from './application/commands/resume-billing.handler';
import { CancelPlanHandler } from './application/commands/cancel-plan.handler';
import { BillingController } from './presentation/billing.controller';

/**
 * Billing bounded context: plan catalog, subscription (simulated, no payment provider), usage
 * meters with pacing, plan changes, pause/cancel and data export. Plan gating itself lives in the
 * shared PlanService/FeatureGuard so other contexts don't depend on this module.
 */
@Module({
  controllers: [BillingController],
  providers: [
    PrismaSubscriptionRepository,
    { provide: SUBSCRIPTION_REPOSITORY, useExisting: PrismaSubscriptionRepository },
    UsageReader,
    BillingReadModel,
    WorkspaceExportReadModel,
    GetBillingHandler,
    GetFeatureLimitHandler,
    ExportWorkspaceHandler,
    ChangePlanHandler,
    PauseBillingHandler,
    ResumeBillingHandler,
    CancelPlanHandler,
  ],
})
export class BillingModule {}
