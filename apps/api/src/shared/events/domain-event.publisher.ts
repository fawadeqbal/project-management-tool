import { Injectable, Optional } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import type { AggregateRoot, DomainEvent } from '@hearth/domain';
import { TransactionScope } from '../persistence/transaction-scope';
import { DomainEventEnvelope } from './domain-event.envelope';

/**
 * Publishes domain events after a successful write. Call `publishFrom(aggregate)` right after
 * `repository.save(aggregate)` so subscribers never observe uncommitted state. Inside a unit of
 * work (UNIT_OF_WORK) events are held until the transaction commits, and dropped if it rolls back.
 */
@Injectable()
export class DomainEventPublisher {
  constructor(
    private readonly bus: EventBus,
    @Optional() private readonly scope?: TransactionScope,
  ) {}

  publish(...events: DomainEvent[]): void {
    if (!events.length) return;
    const send = () => {
      for (const event of events) this.bus.publish(new DomainEventEnvelope(event));
    };
    if (!this.scope?.defer(send)) send();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any aggregate's props shape
  publishFrom(...aggregates: AggregateRoot<any>[]): void {
    for (const a of aggregates) this.publish(...a.pullEvents());
  }
}
