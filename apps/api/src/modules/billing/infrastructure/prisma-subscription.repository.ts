import { Inject, Injectable } from '@nestjs/common';
import { Subscription, type BillingInterval, type Clock, type PlanId, type SubscriptionRepository } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';

/** Adapter: Subscription aggregate ⇄ the Subscription table. Missing rows read as Free. */
@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<Subscription | null> {
    let s = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!s) {
      const now = this.clock.now();
      s = await this.prisma.subscription.create({
        data: { workspaceId, plan: 'FREE', seats: 5, renewsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) },
      });
    }
    return Subscription.restore(s.id, {
      workspaceId,
      plan: s.plan as PlanId,
      interval: s.interval as BillingInterval,
      status: s.status,
      seats: s.seats,
      renewsAt: s.renewsAt,
      pausedUntil: s.pausedUntil,
    });
  }

  async save(subscription: Subscription): Promise<void> {
    const s = subscription.toSnapshot();
    await this.prisma.subscription.update({
      where: { id: s.id },
      data: { plan: s.plan, interval: s.interval, status: s.status, seats: s.seats, renewsAt: s.renewsAt, pausedUntil: s.pausedUntil },
    });
  }
}
