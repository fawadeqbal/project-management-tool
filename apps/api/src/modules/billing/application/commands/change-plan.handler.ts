import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ChangePlanResultDto } from '@hearth/contracts';
import { NotFoundError, SUBSCRIPTION_REPOSITORY, type Clock, type SubscriptionRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { BillingReadModel } from '../../infrastructure/billing.read-model';
import { UsageReader } from '../../infrastructure/usage.reader';
import { ChangePlanCommand } from './change-plan.command';

/** Simulated plan change (no payment provider): applies immediately; lossy downgrades need confirm. */
@CommandHandler(ChangePlanCommand)
export class ChangePlanHandler implements ICommandHandler<ChangePlanCommand, ChangePlanResultDto> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    private readonly usage: UsageReader,
    private readonly read: BillingReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: ChangePlanCommand): Promise<ChangePlanResultDto> {
    const now = this.clock.now();
    const sub = await this.subscriptions.findByWorkspace(actor.workspaceId);
    if (!sub) throw new NotFoundError('Subscription', actor.workspaceId);
    const { seats } = await this.usage.read(actor.workspaceId, now);
    const { lostFeatures } = sub.changePlan({ plan: input.plan, interval: input.interval, confirm: input.confirm, activeSeats: seats }, actor.userId, now);
    await this.subscriptions.save(sub);
    this.events.publishFrom(sub);
    return { billing: await this.read.get(actor), lostFeatures };
  }
}
