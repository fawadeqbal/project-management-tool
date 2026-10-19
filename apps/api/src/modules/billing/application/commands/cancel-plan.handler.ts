import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BillingDto } from '@hearth/contracts';
import { NotFoundError, SUBSCRIPTION_REPOSITORY, type Clock, type SubscriptionRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { BillingReadModel } from '../../infrastructure/billing.read-model';
import { CancelPlanCommand } from './cancel-plan.command';

/** Cancels at the end of the period; the plan keeps working until then and can be resumed. */
@CommandHandler(CancelPlanCommand)
export class CancelPlanHandler implements ICommandHandler<CancelPlanCommand, BillingDto> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    private readonly read: BillingReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, confirm }: CancelPlanCommand): Promise<BillingDto> {
    const sub = await this.subscriptions.findByWorkspace(actor.workspaceId);
    if (!sub) throw new NotFoundError('Subscription', actor.workspaceId);
    sub.cancel(confirm, actor.userId, this.clock.now());
    await this.subscriptions.save(sub);
    this.events.publishFrom(sub);
    return this.read.get(actor);
  }
}
