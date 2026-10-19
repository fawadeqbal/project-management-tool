import { Inject, Injectable } from '@nestjs/common';
import type { Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { PlanService } from '../../../shared/billing/require-feature';

const METRIC = 'ai_credits';

/** AI credits per billing period (UsageCounter, metric 'ai_credits', period YYYY-MM) with the plan limit. */
@Injectable()
export class AiUsageMeter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  period(now: Date = this.clock.now()): string {
    return now.toISOString().slice(0, 7);
  }

  /** Throws limit_reached (402) when one more credit would exceed the plan. */
  async assertAvailable(workspaceId: string, amount = 1): Promise<void> {
    const row = await this.prisma.usageCounter.findUnique({
      where: { workspaceId_metric_period: { workspaceId, metric: METRIC, period: this.period() } },
      select: { value: true },
    });
    (await this.plans.policyFor(workspaceId)).assertWithinLimit('ai_credits', Number(row?.value ?? 0n), amount);
  }

  async record(workspaceId: string, amount = 1): Promise<void> {
    const period = this.period();
    await this.prisma.usageCounter.upsert({
      where: { workspaceId_metric_period: { workspaceId, metric: METRIC, period } },
      create: { workspaceId, metric: METRIC, period, value: BigInt(amount) },
      update: { value: { increment: BigInt(amount) } },
    });
  }
}
