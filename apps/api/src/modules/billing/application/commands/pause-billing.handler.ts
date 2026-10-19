import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BillingDto } from '@hearth/contracts';
import { NotFoundError, SUBSCRIPTION_REPOSITORY, type Clock, type SubscriptionRepository } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { BillingReadModel } from '../../infrastructure/billing.read-model';
import { PauseBillingCommand } from './pause-billing.command';

@CommandHandler(PauseBillingCommand)
export class PauseBillingHandler implements ICommandHandler<PauseBillingCommand, BillingDto> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    private readonly read: BillingReadModel,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, months }: PauseBillingCommand): Promise<BillingDto> {
    const sub = await this.subscriptions.findByWorkspace(actor.workspaceId);
    if (!sub) throw new NotFoundError('Subscription', actor.workspaceId);
    sub.pause(months, actor.userId, this.clock.now());
    await this.subscriptions.save(sub);
    this.events.publishFrom(sub);
    return this.read.get(actor);
  }
}
